import 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import './src/global.css';
import { registerRootComponent } from 'expo';

import App from './src/app/App';

// Configure Reanimated logger: disable strict mode to avoid noisy false-positive warnings
// during component render cycles in Expo / Reanimated v4
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);


