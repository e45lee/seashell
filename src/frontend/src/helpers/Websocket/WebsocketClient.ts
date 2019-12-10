import {AbstractCoder, Coder} from "../Crypto";
import {Connection} from "./Interface";
import * as R from "ramda";
import * as E from "../Errors";
import {Message, Request, Response, Callback} from "./Interface";
import {appStateActions} from "../../reducers/appStateReducer";

export {SeashellWebsocket}


enum OnCloseCode {
  Normal = 1000,
  Abnormal = 1006,
  Unknown = 4000,
  PingTimedOut = 4001
};

const RESPONSE_TIMEOUT = 5000;

class SeashellWebsocket {
  public connection?: Connection;
  private coder: AbstractCoder;
  private websocket?: WebSocket;
  private lastMsgID: number;
  public requests: {[index: number]: Request<any>};
  private closes: () => void;
  private failures: () => void;
  public debug: boolean; // toggle console.log for tests
  private pingLoop: any;
  private callbacks: {[index: number]: Callback};
  private lastPong: number = 0;
  private lastCB: number = 0;

  constructor(debug?: boolean) {
    this.debug = debug || false;
    this.callbacks = [];
  }

  // Connects and authenticates the socket, sets up the disconnection monitor
  // Pass a new Connection object to overwrite the previously held one
  // It must be safe to call this function consecutively many times
  public async connect(cnn: Connection): Promise<void> {
    if (cnn.offline) {
      // if offline, set the offline connection and exit
      this.connection = cnn;
      return;
    }

    const firstTime: () => boolean = () => ! this.connection;
    console.log("Connecting to websocket...");
    this.lastMsgID = 0;
    this.requests = {};
    this.requests[-1] = new Request({id: -1}); // server challenge
    this.requests[-2] = new Request({id: -2}); // reply challenge
    this.requests[-3] = new Request({id: -3});
    this.requests[-4] = new Request({id: -4});
    this.requests[-5] = new Request({id: -5});
    this.requests[-3].callback = this.gen_cb("io");
    this.requests[-4].callback = this.gen_cb("test");
    this.requests[-5].callback = this.gen_cb("changes");
    // if there's an existing websocket,
    // if it's connecting or open: do nothing
    // if it's closing or closed: schedule to open a new connection
    if (this.websocket) {
      const websocket = this.websocket;
      switch (websocket.readyState) {
        case websocket.CONNECTING: {
          console.log("Socket is already connecting. Closing and reconnecting.");
          const promise = new Promise<void>((accept, reject) => {
            websocket.onclose = () => {
              this.connect(cnn).then(accept).catch(reject);
            };
          });
          websocket.close();
          return promise;
        }
        case websocket.OPEN: {
          console.log("Socket is already connected. Closing and reconnecting.");
          const promise = new Promise<void>((accept, reject) => {
            websocket.onclose = () => {
              this.connect(cnn).then(accept).catch(reject);
            };
          });
          websocket.close();
          return promise;
        }
        case websocket.CLOSING: {
          console.log("Existing websocket is closing. Wait to reopen new connection.");
          const promise = new Promise<void>((accept, reject) => {
            // wait for a graceful shutdown then reconnect
            websocket.onclose = () => {
              this.connect(cnn).then(accept).catch(reject);
            };
          });
          return promise;
        }
        case websocket.CLOSED: {
          console.log("Existing websocket is closed. Reopening new connection.");
          // pass through to continue connection
        }
      }
    }

    // continue connection
    let connected: any;
    let failed: any;
    const rtv = new Promise<void>((resolve, reject) => {
      connected = resolve;
      failed = reject;
    });

    this.coder = new Coder(cnn.key as number[]);
    try {
      this.websocket = new WebSocket(cnn.wsURI);
      this.websocket.onerror = (err) => {
        firstTime() && failed(err);
      };
    } catch (err) {
      console.error(`Could not create WebSocket connection to ${cnn.wsURI}:\n${err}`);
      firstTime() && failed();
      return;
    }

    // Websocket.onclose should race against authentication
    this.websocket.onclose = (evt: CloseEvent) => {
      this.invoke_cb("disconnected");
      console.warn("Websocket lost connection.");
      clearInterval(this.pingLoop);
      for (const i in this.requests) {
        if (parseInt(i) >= -2) {
          if (evt.code === OnCloseCode.Unknown) {
            this.requests[i].reject(new E.WebsocketError(evt.reason));
          } else {
            this.requests[i].reject(new E.RequestAborted("RequestAborted: Websocket disconnected."));
          }
        }
        if (parseInt(i) >= 0) {
          delete this.requests[i];
        }
      }
      // exited abnormally,
      // could be internet disruption, handshake timeout, connection refused
      // if this.connection exists, then we have successfully connected automatically reconnect after 3s
      if (evt.code === OnCloseCode.Abnormal && firstTime()) {
        firstTime() && failed();
        return;
      }
      // all other onclose codes:
      console.warn("Reconnect in 5 seconds...");
      setTimeout(() => {
        // when user logs out,
        // this.disconnect must clear this.connection
        if (this.connection) {
          // ignore a failure, we will attempt to reconnect anyway
          this.connect(cnn).catch((err) => { });
        } else {
          console.warn("Gave up reconnection. User probably logged out.");
        }
      }, RESPONSE_TIMEOUT);
    };

    this.websocket.onopen = () => {
      let timeoutCount = 0;
      if (this.pingLoop) {
        clearInterval(this.pingLoop);
      }
      this.pingLoop = setInterval(async () => {
        timeoutCount++;
        if (timeoutCount >= 3) {
          console.warn(`Ping timed out. Server is not responsive. [${timeoutCount - 2}]`);
          if (this.websocket) {// Always reachable
            console.warn("Closing connection to restart...");
            this.websocket.close(OnCloseCode.PingTimedOut); // force reconnect
          }
        }
        await this.ping();
        timeoutCount = 0;
      }, RESPONSE_TIMEOUT);
    };

    this.websocket.onmessage = async (message: MessageEvent) => {
      if (message.data instanceof Blob) {
        const readerT = new FileReader();
        readerT.onloadend = async () => {
          await this.resolveRequest(<string>readerT.result);
        };
        readerT.readAsText(message.data);
      } else {
        const u8arr = new Uint8Array(message.data);
        const str: string = R.reduce((str, byte) => str + String.fromCharCode(byte), "", Array.from(u8arr));
        await this.resolveRequest(str);
      }
    };

    this.debug && console.log("Waiting for server response -- setting timeout for %d seconds...", RESPONSE_TIMEOUT);
    // if the server doesn't response in 5s
    // the default chrome's handshake timeout is too long
    let responseTimeout = setTimeout(() => {
      if (this.websocket) {
        this.websocket.close();
        // will close with 1006
        // fall back to websocket.onclose()
      }
    }, RESPONSE_TIMEOUT);
    let serverChallenge: any;
    try {
      serverChallenge = await this.requests[-1].received;
    } catch (err) {
      console.warn("Invalid server response -- timeout cleared.");
      clearTimeout(responseTimeout);
      throw err;
    }
    clearTimeout(responseTimeout);

    try {
      const result = await this.coder.answer(serverChallenge);
      const response = [result.iv,
                        result.encrypted,
                        result.authTag,
                        result.nonce];

      this.requests[-2].message = {
        id: -2,
        type: "clientAuth",
        response: response
      };

      this.debug && console.log("Authenticating websocket...");

      // Authentication should race against websocket.onclose
      await this.sendRequest(this.requests[-2]);

      this.invoke_cb("connected");
    } catch (err) {
      if (err instanceof E.RequestError) {
        firstTime() && failed();
        return;
      } else {
        throw err;
      }
    }

    // connection done
    this.connection = cnn;
    connected();
    return rtv;
  }

  private resolveRequest(responseText: string): void {
    const response = <Response>(JSON.parse(responseText));
    // Assume the response holds the message and response.id holds the
    //  message identifier that corresponds with it
    // response.result will hold the result if the API call succeeded,
    //  error message otherwise.
    const request = this.requests[response.id];
    const time = new Date();
      const diff = request.time ? time.getTime() - request.time : -1;
      if (response.success) {
        if (request.message.type === "ping") {
          this.lastPong = Date.now();
        } else {
          this.debug && console.log(`Request ${response.id} succeeded after ${diff} ms`, response);
        }
      } else {
        this.debug && console.warn(`Request ${response.id} failed after ${diff} ms`, request.message, response);
      }
    if (response.id >= 0) {
      delete this.requests[response.id];
    } else if (this.requests[response.id].callback) {
      this.requests[response.id].callback(response.result);
    }
    if (response.success) {
      request.resolve(response.result);
    } else if (! this.isConnected()) {
      // test if is not authenticated
      // better have the backend reject with "unauthenticated" error,
      // instead of the current "invalid message"
      request.reject(new E.LoginRequired());
    } else {
      const diff = request.time ? time.getTime() - request.time : -1;
      request.reject(new E.RequestError(`Request ${request.message.id} failed with response: ${response.result}`,
                                        request,
                                        response));
    }
  }

  public disconnect(): void {
    this.connection = undefined;
    if (this.websocket) {
      this.websocket.close(OnCloseCode.Normal);
      clearInterval(this.pingLoop);
    }
    this.websocket = undefined;
  }

  public register_callback(type: string, cb: (message?: any) => any, now?: boolean): number {
    this.callbacks[this.lastCB++] = new Callback(type, cb, now || false);

    if (type === "disconnected" && ! this.isConnected() && now) {
      cb();
    } else if (type === "connected" && this.isConnected() && now) {
      cb();
    }
    return this.lastCB - 1;
  }

  public unregister_callback(key: number) {
    delete this.callbacks[key];
  }

  public async invoke_cb(type: string, message?: any): Promise<Array<any>> {
    return (<any>Object).values(this.callbacks).filter(
      (x: Callback) => { return x && x.type === type; }).map(
        async (x: Callback) => { return x.cb(message); });
  }

  // Helper function to invoke the I/O callback.
  private gen_cb = (type: string) => {
    return async (message: any) => {
      return this.invoke_cb(type, message);
    };
  }

  private sendRequest<T>(request: Request<T>): Promise<T> {
    // If user's computer goes to sleep the server doesn't receive response for 5 minutes,
    // the next request should throw LoginRequired since the server will die of inactivity.
    // This timeout should be <= the timeout on the server side.
    // if (! R.contains(request.message.type, ["clientAuth", "authenticate", "ping"]) &&
    //     Date.now() - this.lastPong >= 10 * 1000) {
    //   throw new E.LoginRequired("You've been offline for a while. We'd like to confirm who you are.");
    // }
    if (! this.isConnected()) {
      throw new E.NoInternet();
    }
    const msg   = request.message;
    const msgID = msg.id;
    this.requests[msgID] = request;
    const blob = JSON.stringify(msg);
    if (msg.type !== "ping") {
      this.debug && console.log(`Request ${msgID} was sent`, msg);
    }
    if (this.websocket) {
      this.websocket.send(blob);
    } else {
      throw new E.LoginRequired();
    }
    return request.received;
  }

  /** Sends a message along the connection, ensuring that
   *  the server and client are properly authenticated.
   *
   *  If the socket has not been properly authenticated,
   *  sends the message after the socket has been properly
   *  authenticated/set up. */
  public sendMessage<T>(message: Message): Promise<T> {
    const msgID = this.lastMsgID++;
    message.id = msgID;
    return this.sendRequest<T>(new Request<T>(message));
  }

  public isConnected(): boolean {
    return this.websocket !== undefined &&
           this.websocket.readyState === this.websocket.OPEN;
  }

  public async ping(): Promise<void> {
    await this.sendMessage({
      type: "ping"
    });
  }

  public getUsername(): string {
    if (!this.connection) {
      throw new E.WebsocketError("Trying to access username when the connection is not set.");
    }
    return this.connection.username;
  }

}
