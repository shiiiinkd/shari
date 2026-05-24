import { registerRootComponent } from "expo";

import App from "./App";
import { primeShareIntent } from "./src/lib/shareIntent";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

// React のマウントより前に初期 URL の取得を開始しておく。
// navigation 側（linking config）も getInitialURL を呼ぶが、結果は
// shareIntent モジュール内でキャッシュされ、useShareIntent 経由で
// 起動直後の画面からも参照できるようになる。
primeShareIntent();

registerRootComponent(App);
