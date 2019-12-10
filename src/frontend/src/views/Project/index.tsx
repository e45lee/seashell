import * as React from "react";
import {RouteComponentProps, Redirect} from "react-router-dom";
import {Popover, Position, Tooltip} from "@blueprintjs/core";
import {map, actionsInterface} from "../../actions";
import DisplayFiles from "./Files/Display";
import QuestionList from "./QuestionList";
import ListFiles from "./Files/List";
import OpenFiles from "./Files/Open";
import Navigation from "../../partials/Navigation";
import {Dialog} from "@blueprintjs/core";
const styles = require("./Project.scss");
const layoutStyles = require("../../Layout.scss");
import {merge} from "ramda";
import CopyPrompt from "./Prompt/Copy";
import RenamePrompt from "./Prompt/Rename";
import DeleteFilePrompt from "./Prompt/DeleteFile";
import DeleteProjectPrompt from "./Prompt/DeleteProject";
import MarmosetResultPrompt from "./Prompt/MarmosetResult";
import AddFilePrompt from "./Prompt/AddFile";
import AddTestPrompt from "./Prompt/AddTest";
import AddQuestionPrompt from "./Prompt/AddQuestion";
import ConflictPrompt from "./Prompt/Conflict";
import Splash from "./Splash";
import Loading from "./Loading";
import { showError } from "../../partials/Errors";
import {appStateReducerProjectState} from "../../reducers/appStateReducer";
import * as S from "../../helpers/Storage/Interface";
import ProjectMenu from "./ProjectMenu";
import {HotKeys} from "react-hotkeys";

interface ProjectProps extends RouteComponentProps
    <{name: string, id: S.ProjectID}> {
  title: string;
}

interface ProjectState {
  toggleView: boolean;
  marmosetResults: {
    open: boolean;
    result: any
  };
}

const keyMap = {
  "increaseFont": ["ctrl+.", "command+."],
  "decreaseFont": ["ctrl+,", "command+,"],
  "run": ["ctrl+r", "command+r"],
  "setAndRun": ["ctrl+shift+r", "command+shift+r"],
  "test": ["ctrl+e", "command+e"],
  "kill": ["ctrl+k", "command+k"]
};

class Project extends React.Component<ProjectProps&actionsInterface, ProjectState> {
  private handlers: { [index: string]: (event: Event) => any } = {};

  constructor(props: ProjectProps&actionsInterface) {
    super(props);
    this.state = {
      toggleView: false,
      marmosetResults: {
        open: false,
        result: null
      }
    };

    this.handlers = {
      "run": (e) => { e.preventDefault(); this.runFile(); },
      "kill": (e) => { e.preventDefault(); this.stopProgram(); },
      "setAndRun": (e) => { e.preventDefault(); this.setAndRun(); },
      "increaseFont": (e) => { e.preventDefault(); this.adjustFont(1); },
      "decreaseFont": (e) => { e.preventDefault(); this.adjustFont(-1); }
    };
  }

  private adjustFont(size: number) {
    this.props.dispatch.settings.adjustFont(size);
  }

  private runFile() {
    const project = this.props.appState.currentProject;
    if (project) {
      const question = project.currentQuestion;
      if (question) {
        this.props.dispatch.compile.compileAndRun(project.id, question.name, question.runFile, false);
      }
    }
  }

  private async setAndRun() {
    const project = this.props.appState.currentProject;
    if (project) {
      const question = project.currentQuestion;
      if (question) {
        const file = question.currentFile;
        if (file) {
          await this.props.dispatch.file.setRunFile(project.id, question.name, file.name);
          this.runFile();
        }
      }
    }
  }

  private stopProgram() {
    const project = this.props.appState.currentProject;
    if (project) {
      const question = project.currentQuestion;
      if (question) {
        if (this.props.appState.runState) {
          this.props.dispatch.compile.stopProgram();
        }
      }
    }
  }

  private matchMarmosetProject(project: string, question: string): string {
    const candidate = `${project}${question}`.toUpperCase();
    const found = (this.props.appState.marmosetProjects || []).find((p: S.MarmosetProject) =>
      candidate === p.project);
    return found === undefined ? "" : found.project;
  }

  generateMarmosetButton(project: appStateReducerProjectState) {
      if (project.currentQuestion) {
        const marmosetDispatch = (async (projectName: string, questionName: string) => {
          this.setState({marmosetResults: {
            open: true,
            result: null
          }});
          await this.props.dispatch.project.getMarmosetProjects();
          const result = await this.props.dispatch.question.getMarmosetResults(
            this.matchMarmosetProject(projectName, questionName));
          this.setState({marmosetResults: {
            open: true,
            result: result
          }});
        }).bind(this, project.name, project.currentQuestion.name);
        return (<Tooltip key="project-submit-marmoset" content="Submit to Marmoset" position={Position.BOTTOM_RIGHT}>
                <button className="pt-button pt-minimal pt-icon-share" onClick={marmosetDispatch}>
                </button>
            </Tooltip>);
      }
      return <span />;
  }

  componentWillMount() {
    const willOpenPid = this.props.match.params.id;
    const willOpenName = this.props.match.params.name;
    let state = this.props.appState;
    if (!state.currentProject || willOpenPid !== state.currentProject.id) {
      if (state.currentProject) {
        this.props.dispatch.file.invalidateFile();
      }
      // force wait until promise is resolved
      this.props.dispatch.project.switchProject(willOpenName, willOpenPid).catch((reason) => {
        if (reason !== null) {
          showError(reason.message);
        }
      });
    }
  }

  toggleView() {
    this.setState(merge(this.state, {toggleView: !this.state.toggleView}));
  }

  render() {
    const project = this.props.appState.currentProject;
    // Inconsistent state --> go home.
    if (this.props.appState.inconsistent) {
      return <Redirect to="/" />;
    } else if (project) {
      const question = project.currentQuestion;
      return (
        <HotKeys keyMap={keyMap} handlers={this.handlers}>
          <Navigation
            navLeft={[
              <Popover popoverClassName="pt-minimal" content={<ProjectMenu />} position={Position.BOTTOM_LEFT}>
                <button className="pt-button" key="project-name">
                  <span className="pt-icon-standard pt-icon-caret-down" />
                  {project.name}
                </button>
              </Popover>,
              <Popover popoverClassName="pt-minimal" content={<QuestionList />} key="project-question" position={Position.BOTTOM}>
                <button className="pt-button pt-intent-primary">
                  <span className="pt-icon-standard pt-icon-caret-down" />
                  {question ? question.name : "Select a Question"}
                </button>
              </Popover>,
              question ?
                <span className="pt-navbar-divider" key="project-divider" /> :
                <span key="empty-project-divider" />,
              question ?
                <Popover popoverClassName="pt-minimal" content={<ListFiles />}
                    position={Position.BOTTOM} key="project-open-file">
                  <button className="pt-button">
                    <span className="pt-icon-standard pt-icon-caret-down" />
                    Open File
                  </button>
                </Popover> :
                <span key="empty-project-open-file"/>
            ].map((item, index) => <div key={index}>{item}</div>)}
            navRight={(! question) ? [] : [
              <OpenFiles key="project-open-files" />,
              <Tooltip key="project-toggle-view" content="Toggle Editor/Console"
                  position={Position.BOTTOM}>
                <button onClick={this.toggleView.bind(this)}
                    className={"pt-button pt-minimal pt-icon-applications " + styles.toggleView}>
                </button>
              </Tooltip>,
              <Tooltip key="project-build-file" content="Test" position={Position.BOTTOM_RIGHT}>
                {this.props.appState.runState !== 0 || !question.runFile ?
                  <button className="pt-button pt-minimal pt-disabled pt-icon-comparison"></button> :
                  <button className="pt-button pt-minimal pt-icon-comparison"
                    onClick={() =>
                      this.props.dispatch.file.flushFileBuffer()
                        .then(this.props.dispatch.compile.compileAndRun
                          .bind(this, project.id, question.name, question.runFile, true))}>
                  </button>
                }
              </Tooltip>,
              this.props.appState.runState === 0 ?
                <div>
                  {!question.runFile ?
                    <Tooltip key="project-run-file-set" content="Please set a run file"
                        position={Position.BOTTOM_RIGHT}>
                      <button className="pt-button pt-minimal pt-disabled pt-icon-play"></button>
                    </Tooltip> :
                    <Tooltip key="project-run-file" content="Run" position={Position.BOTTOM_RIGHT}>
                      <button className="pt-button pt-minimal pt-icon-play"
                        onClick={() => this.runFile()}>
                      </button>
                    </Tooltip>
                  }
                  <Tooltip key="project-set-and-run-file" content="Set and Run" position={Position.BOTTOM_RIGHT}>
                    {question.currentFile ?
                      <button className="pt-button pt-minimal pt-icon-fast-forward"
                        onClick={() => this.setAndRun()} /> :
                      <button className="pt-button pt-minimal pt-icon-fast-forward pt-disabled"/>
                    }
                  </Tooltip>
                </div> :
                this.props.appState.runState === 1 ?
                  <Tooltip key="project-run-file" content="Compiling"
                      position={Position.BOTTOM_RIGHT}>
                    <button className={"pt-button pt-minimal pt-disabled pt-icon-cog " + styles.spinningImage}>
                    </button>
                  </Tooltip> :
                  <Tooltip key="project-run-file" content="Stop" position={Position.BOTTOM_RIGHT}>
                    <button className="pt-button pt-minimal pt-icon-stop"
                        onClick={() => this.stopProgram()}>
                    </button>
                  </Tooltip>,
              this.generateMarmosetButton(project)].map((item, index) => <div key={index}>{item}</div>)
            }/>
          {question && question.currentFile ?
            <DisplayFiles className={this.state.toggleView ? styles.rightToggle : styles.leftToggle}/>
              : <Splash />}
          <Dialog className={styles.dialogStyle} title="Delete File"
              isOpen={this.props.dialog.delete_file_open}
              onClose={this.props.dispatch.dialog.toggleDeleteFile}>
            <DeleteFilePrompt closefunc={this.props.dispatch.dialog.toggleDeleteFile}/>
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Delete Project"
              isOpen={this.props.dialog.delete_project_open}
              onClose={this.props.dispatch.dialog.toggleDeleteProject}>
            <DeleteProjectPrompt closefunc={this.props.dispatch.dialog.toggleDeleteProject}/>
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Rename/Move File"
              isOpen={this.props.dialog.rename_file_open}
              onClose={this.props.dispatch.dialog.toggleRenameFile}>
            <RenamePrompt questions={project.questions}
                closefunc={this.props.dispatch.dialog.toggleRenameFile}/>
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Copy File"
              isOpen={this.props.dialog.copy_file_open}
              onClose={this.props.dispatch.dialog.toggleCopyFile}>
            <CopyPrompt questions={project.questions}
                closefunc={this.props.dispatch.dialog.toggleCopyFile}/>
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Add File"
              isOpen={this.props.dialog.add_file_open}
              onClose={this.props.dispatch.dialog.toggleAddFile}>
            <AddFilePrompt questions={project.questions}
                closefunc={this.props.dispatch.dialog.toggleAddFile}/>
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Add Test"
              isOpen={this.props.dialog.add_test_open}
              onClose={this.props.dispatch.dialog.toggleAddTest}>
            <AddTestPrompt questions={project.questions}
                closefunc={this.props.dispatch.dialog.toggleAddTest}/>
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Add Question"
              isOpen={this.props.dialog.add_question_open}
              onClose={this.props.dispatch.dialog.toggleAddQuestion}>
            <AddQuestionPrompt closefunc={this.props.dispatch.dialog.toggleAddQuestion} />
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Resolve Conflict"
              isOpen={this.props.dialog.resolve_conflict_open}
              onClose={this.props.dispatch.dialog.toggleResolveConflict}>
            <ConflictPrompt closefunc={this.props.dispatch.dialog.toggleResolveConflict} />
          </Dialog>
          <Dialog className={styles.dialogStyle} title="Marmoset Results"
              isOpen={this.state.marmosetResults.open}
              onClose={(() => {
                this.setState({marmosetResults: {open: false, result: this.state.marmosetResults.result}});
                this.props.dispatch.question.clearMarmosetInterval();
              }).bind(this)}>
                  <MarmosetResultPrompt result={this.state.marmosetResults.result} />
          </Dialog>
      </HotKeys>);
    } else {
      return (
        <div>
          <Navigation navLeft={[]} navRight={[]} />
          <Loading/>
        </div>
      );
    }
  }
}

export default map<ProjectProps>(Project);
