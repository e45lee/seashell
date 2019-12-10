import * as React from "react";
import { withRouter, RouteComponentProps } from "react-router-dom";
import Layout from "./Layout";
import SignIn from "./views/SignIn";
import {map, actionsInterface} from "./actions";

export interface AppProps extends RouteComponentProps<{}> { }
export interface AppState { }

class App extends React.Component<AppProps&actionsInterface, AppState> {
  render() {
    const projects = this.props.appState.projects;
    return this.props.user.questid == null ? <SignIn/> :
    (<Layout/>);
  }
}

export default withRouter(map<AppProps>(App));
