import { createNavigationContainerRef } from '@react-navigation/native';

// A ref-based escape hatch for navigating from places that don't have a
// reliable React context path back to NavigationContainer — most notably
// ClientSidebar, which renders through a React Native <Modal>. On Android,
// Modal can sever context propagation to its children even though they're
// still the same JS tree, so a `navigation` object obtained via useNavigation()
// (or passed down as a prop from a component that has it) can throw
// "Couldn't find a navigation context" the moment one of its methods is
// called from inside the Modal. This ref sidesteps React context entirely.
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
