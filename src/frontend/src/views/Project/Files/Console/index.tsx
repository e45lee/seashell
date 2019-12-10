import * as React from "react";
import { Terminal } from "xterm";
import { merge } from "ramda";
import { Services } from "../../../../helpers/Services";
import { FitAddon } from "xterm-addon-fit";
import { GenericError } from "../../../../helpers/Errors";

export interface ConsoleProps {
  readOnly: boolean;
  style?: any;
  className?: string;
  dispatch: any;
  consoleText: string;
}

export interface ConsoleState {
  input: boolean;
  line: number;
  currString: string;
};

const customStyles = require("./Console.scss");
const styles = require("xterm/css/xterm.css");

export default class Xterm extends React.PureComponent<ConsoleProps, ConsoleState> {
  term: Terminal;
  fit: FitAddon;
  container?: HTMLElement;

  constructor(props: ConsoleProps, context: any) {
    super(props, context);
    this.term = new Terminal({
      cursorBlink: true
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.container = undefined;
  }

  dataReceived(payload: string) {
    this.term.write(payload.replace(/\r?\n/g, "\r\n"));
  }

  clear(): void {
    this.term.clear();
  }

  getLines(): number {
    return document.getElementsByClassName("xterm-rows")[0].childElementCount;
  }

  setHeight(height: Number) {
    this.container && (this.container.style.height = height + "px");
  }

  setFlex(flex: any) {
    this.container && (this.container.style.flex = flex);
  }

  updateLayout() {
    this.fit.fit();
  }

  componentWillMount() {
    this.props.dispatch.app.setTerm(
      this.dataReceived.bind(this),
      this.clear.bind(this));
  }

  componentDidMount() {
    let container = this.container;

    if (container) {
      this.term.open(container);
      if (this.props.consoleText) this.term.write(this.props.consoleText.replace(/\r?\n/g, "\r\n"));
      this.setState({ input: true, line: 1, currString: "" });
      this.term.onKey((event: {key: string, domEvent: KeyboardEvent}) => {
        if (!this.props.readOnly) {
          Services.compiler().programInput(event.key);
      }});
    } else {
      // Shouldn't ever get here, toss an exception
      throw new GenericError("Couldn't get HTML container for XTerm element!");
    }
  }

  componentWillUnmount() {
    this.props.dispatch.app.setTerm(null, null);
    this.term.dispose();
  }

  render() {
    let style = {...this.props.style};
    return(<div style={this.props.style}
                className={this.props.className}
                ref={(container: HTMLElement | null) => { this.container = container as HTMLElement; }}>
           </div>);
  }
}
