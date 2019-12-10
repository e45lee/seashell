import * as React from "react";
import {Menu, MenuItem} from "@blueprintjs/core";
import {map, actionsInterface} from "../../actions";

const styles = require("./Project.scss");

class ProjectMenu extends React.Component<actionsInterface, {}> {

  constructor(props: actionsInterface) {
    super(props);
  }

  render() {
    const project = this.props.appState.currentProject;
    if (project) {
      return (<Menu>
        <MenuItem onClick={() => { this.props.dispatch.project.downloadProject(project.id, project.name); }}
                  icon="download"
                  text="Download Project" />
        <MenuItem onClick={() => { this.props.dispatch.dialog.toggleDeleteProject(); }}
                  icon="trash"
                  text="Delete Project" />
      </Menu>);
    } else {
      throw new Error("Invoking ProjectMenu on undefined project!");
    }
  }
}

export default map<{}>(ProjectMenu);
