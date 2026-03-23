import "react-native-url-polyfill/auto";
import "react-native-gesture-handler";
import { AppRegistry } from "react-native";

import DevBoardPlayerApp from "./src/DevBoardPlayerApp";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => DevBoardPlayerApp);
