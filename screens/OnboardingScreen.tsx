import React from "react";
import { View, StyleSheet, Image, Dimensions, Alert } from "react-native";
import {
  Text,
  Button,
  ActivityIndicator,
  useTheme,
  Portal,
  Dialog,
  TextInput,
} from "react-native-paper";
import { useAppStore } from "../store/appStore";
import { ThemeColors } from "../styles/theme";

const { width } = Dimensions.get("window");

export default function OnboardingScreen() {
  const { login, loginOffline, authLoading, theme } = useAppStore();
  const activeColors = ThemeColors[theme];

  const [dialogVisible, setDialogVisible] = React.useState(false);
  const [offlineName, setOfflineName] = React.useState("");

  const handleGoogleLogin = async () => {
    try {
      await login(); // Google Authenticated login
    } catch (e: any) {
      console.error("Google Sign-In Error:", e);
      Alert.alert(
        "Login Failed",
        "Unable to authenticate with Google. Please verify your client ID and configuration, then try again.",
      );
    }
  };

  const handleContinueOfflineClick = () => {
    setOfflineName("");
    setDialogVisible(true);
  };

  const handleOfflineLogin = async () => {
    if (!offlineName.trim()) {
      Alert.alert(
        "Name Required",
        "Please enter your name to personalize your profile.",
      );
      return;
    }
    setDialogVisible(false);
    try {
      await loginOffline(offlineName.trim());
    } catch (e: any) {
      console.error("Offline Sign-In Error:", e);
      Alert.alert("Error", "Unable to start offline mode. Please try again.");
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: activeColors.background }]}
    >
      {/* Brand logo container */}
      <View style={styles.heroContainer}>
        <View
          style={[
            styles.glowRing,
            { borderColor: activeColors.primary + "20" },
          ]}
        >
          <View
            style={[
              styles.glowInnerRing,
              {
                borderColor: activeColors.primary + "40",
                backgroundColor: activeColors.primary + "08",
              },
            ]}
          >
            <Text style={[styles.brandText, { color: activeColors.primary }]}>
              EZ
            </Text>
          </View>
        </View>

        <Text style={[styles.appName, { color: activeColors.text }]}>
          EZ Finance
        </Text>
        <Text
          style={[styles.appTagline, { color: activeColors.textSecondary }]}
        >
          The Ultimate Offline-First Personal Finance Vault
        </Text>
      </View>

      {/* Authentication controls */}
      <View style={styles.actionsContainer}>
        {authLoading ? (
          <ActivityIndicator
            size="large"
            color={activeColors.primary}
            style={styles.loader}
          />
        ) : (
          <>
            <Button
              mode="contained"
              icon="google"
              onPress={handleGoogleLogin}
              style={[styles.button, { backgroundColor: activeColors.text }]}
              labelStyle={{
                color: activeColors.background,
                fontWeight: "bold",
              }}
              contentStyle={styles.buttonContent}
            >
              Sign In with Google
            </Button>

            <Button
              mode="outlined"
              icon="swap-horizontal"
              onPress={handleContinueOfflineClick}
              style={[
                styles.button,
                { borderColor: activeColors.primary, borderStyle: "dashed" },
              ]}
              labelStyle={{ color: activeColors.primary, fontWeight: "bold" }}
              contentStyle={styles.buttonContent}
            >
              Continue Offline
            </Button>
          </>
        )}

        <Text
          style={[styles.footerText, { color: activeColors.textSecondary }]}
        >
          Fully encrypted. Syncs automatically with your Google AppData.
        </Text>
      </View>

      {/* Portal Dialog for getting custom username */}
      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
          style={{ backgroundColor: activeColors.surface, borderRadius: 18 }}
        >
          <Dialog.Title
            style={{ color: activeColors.text, fontWeight: "bold" }}
          >
            Offline Profile
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{ color: activeColors.textSecondary, marginBottom: 15 }}
            >
              Please enter your name to personalize your offline experience.
            </Text>
            <TextInput
              label="Your Name"
              value={offlineName}
              onChangeText={setOfflineName}
              mode="outlined"
              activeOutlineColor={activeColors.primary}
              outlineColor={activeColors.border}
              textColor={activeColors.text}
              style={{ backgroundColor: activeColors.surface }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setDialogVisible(false)}
              labelStyle={{ color: activeColors.textSecondary }}
            >
              Cancel
            </Button>
            <Button
              onPress={handleOfflineLogin}
              labelStyle={{ color: activeColors.primary, fontWeight: "bold" }}
            >
              Start Offline
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 40,
  },
  heroContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  glowRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  glowInnerRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  brandText: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  appName: {
    fontSize: 34,
    fontWeight: "bold",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  appTagline: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  actionsContainer: {
    width: "100%",
    alignItems: "center",
  },
  button: {
    width: "100%",
    borderRadius: 14,
    marginBottom: 16,
  },
  buttonContent: {
    height: 52,
  },
  loader: {
    marginVertical: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 20,
  },
});
