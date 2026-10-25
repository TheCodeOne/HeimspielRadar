import 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import './src/global.css';
import { registerRootComponent } from 'expo';

import App from './src/app/App';

// Configure Reanimated logger: disable strict mode and filter known upstream third-party warnings
// (such as @gorhom/bottom-sheet passing dependencies to useAnimatedReaction on native)
configureReanimatedLogger(
  {
    level: ReanimatedLogLevel.warn,
    strict: false,
  },
  (log) => {
    // Suppress upstream third-party warning from @gorhom/bottom-sheet on native
    if (log?.message?.includes('Dependencies should only be used on the web')) {
      return;
    }
  },
);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);


