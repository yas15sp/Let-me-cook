import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import CookScreen from '../screens/CookScreen';
import RivalsScreen from '../screens/RivalsScreen';
import EventsScreen from '../screens/EventsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RankUpScreen from '../screens/RankUpScreen';
import { colors, typography, borders } from '../theme';

const Tab = createBottomTabNavigator();
const Root = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.border,
          borderTopColor: colors.border,
          borderTopWidth: borders.thin,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inactive,
        tabBarLabelStyle: {
          fontWeight: typography.fontWeight.bold,
          fontSize: typography.fontSize.xs,
          letterSpacing: typography.letterSpacing.wide,
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Cook"
        component={CookScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="play" size={size} color={color} />,
          tabBarItemStyle: {
            backgroundColor: colors.primary,
            borderRadius: 0,
            marginVertical: 0,
          },
          tabBarActiveTintColor: colors.white,
          tabBarInactiveTintColor: colors.white,
        }}
      />
      <Tab.Screen
        name="Rivals"
        component={RivalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        <Root.Screen name="MainTabs" component={MainTabs} />
        <Root.Screen
          name="RankUp"
          component={RankUpScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
      </Root.Navigator>
    </NavigationContainer>
  );
}
