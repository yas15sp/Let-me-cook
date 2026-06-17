import { View, Text, Image, StyleSheet } from 'react-native';
import { borders } from '../theme';

export default function AvatarImage({ uri, letters, rankColor, size = 40 }) {
  return (
    <View style={[
      styles.container,
      { width: size, height: size, borderRadius: size / 2, borderColor: rankColor },
    ]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.32 }]}>{letters}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: borders.medium,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
