import * as React from "react";
import {ProgressBar, Intent} from "@blueprintjs/core";

const styles = require("./Project.scss");

export default () => (<div className={styles.loading}><ProgressBar intent={Intent.PRIMARY} value={undefined} /></div>);