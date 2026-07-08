import React from "react";
import { View, StyleSheet, Image, Dimensions, Alert, ScrollView } from "react-native";
import {
  Text,
  Button,
  ActivityIndicator,
  useTheme,
  Portal,
  Dialog,
  TextInput,
  List,
} from "react-native-paper";
import { useAppStore } from "../store/appStore";
import { ThemeColors } from "../styles/theme";
import { CURRENCIES } from "../services/utils";
import SlideUpModal from "../components/SlideUpModal";
import { AuthService } from "../services/auth";

const { width } = Dimensions.get("window");

export default function OnboardingScreen() {
  const { login, loginOffline, authLoading, theme, tempGoogleSession, setTempGoogleSession } = useAppStore();
  const activeColors = ThemeColors[theme];

  const [step, setStep] = React.useState<'WELCOME' | 'OFFLINE_NAME' | 'CURRENCY_SELECT'>('WELCOME');
  const [offlineName, setOfflineName] = React.useState("");
  const [currencyPref, setCurrencyPref] = React.useState<string>('USD');
  const [showCurrencyModal, setShowCurrencyModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isOfflineFlow, setIsOfflineFlow] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  React.useEffect(() => {
    if (tempGoogleSession) {
      setIsOfflineFlow(false);
      setStep('CURRENCY_SELECT');
    }
  }, [tempGoogleSession]);

  const filteredCurrencies = React.useMemo(() => {
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const session = await AuthService.signIn();
      setTempGoogleSession(session);
      setIsOfflineFlow(false);
      setStep('CURRENCY_SELECT');
    } catch (e: any) {
      console.error("Google Sign-In Error:", e);
      Alert.alert(
        "Login Failed",
        "Unable to authenticate with Google. Please verify your client ID and configuration, then try again.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleContinueOfflineClick = () => {
    setOfflineName("");
    setIsOfflineFlow(true);
    setStep('OFFLINE_NAME');
  };

  const handleOfflineNameNext = () => {
    if (!offlineName.trim()) {
      Alert.alert(
        "Name Required",
        "Please enter your name to personalize your profile.",
      );
      return;
    }
    setStep('CURRENCY_SELECT');
  };

  const handleOfflineLogin = async () => {
    try {
      await loginOffline(offlineName.trim(), currencyPref);
    } catch (e: any) {
      console.error("Offline Sign-In Error:", e);
      Alert.alert("Error", "Unable to start offline mode. Please try again.");
    }
  };

  const isCurrencyStep = step === 'CURRENCY_SELECT';
  const userName = isOfflineFlow ? offlineName : (tempGoogleSession?.name || "User");

  if (isCurrencyStep) {
    return (
      <View
        style={[styles.container, { backgroundColor: activeColors.background }]}
      >
        {/* Back Button */}
        <Button
          mode="text"
          icon="arrow-left"
          onPress={() => {
            setStep(isOfflineFlow ? 'OFFLINE_NAME' : 'WELCOME');
            if (!isOfflineFlow) {
              setTempGoogleSession(null);
            }
          }}
          style={styles.backButton}
          textColor={activeColors.textSecondary}
        >
          Back
        </Button>

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
              <Text style={{ fontSize: 36, fontWeight: "bold", color: activeColors.primary }}>
                {CURRENCIES.find(c => c.code === currencyPref)?.symbol || "$"}
              </Text>
            </View>
          </View>

          <Text style={[styles.appName, { color: activeColors.text, fontSize: 28 }]}>
            Primary Currency
          </Text>
          <Text
            style={[styles.appTagline, { color: activeColors.textSecondary }]}
          >
            Welcome, {userName}! Select the primary currency to manage your transactions and accounts.
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          <Text style={[styles.currencyLabel, { color: activeColors.textSecondary }]}>
            Select Currency
          </Text>
          <Button
            mode="outlined"
            onPress={() => setShowCurrencyModal(true)}
            style={styles.currencySelector}
            labelStyle={{ color: activeColors.text }}
            contentStyle={{ height: 48, justifyContent: 'space-between', flexDirection: 'row-reverse' }}
            icon="chevron-down"
          >
            {CURRENCIES.find(c => c.code === currencyPref)?.name || currencyPref} ({currencyPref})
          </Button>

          <Button
            mode="contained"
            onPress={isOfflineFlow ? handleOfflineLogin : () => {
              if (tempGoogleSession) {
                login(tempGoogleSession, currencyPref);
              }
            }}
            style={[styles.button, { backgroundColor: activeColors.primary }]}
            labelStyle={{
              color: activeColors.background,
              fontWeight: "bold",
            }}
            contentStyle={styles.buttonContent}
            loading={authLoading}
            disabled={authLoading}
          >
            Finish Setup
          </Button>
        </View>

        {/* Currency Picker Modal */}
        <SlideUpModal
          visible={showCurrencyModal}
          onClose={() => {
            setShowCurrencyModal(false);
            setSearchQuery("");
          }}
          backgroundColor={activeColors.surface}
          indicatorColor={activeColors.border}
        >
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: activeColors.text, marginBottom: 12 }}>
              Select Primary Currency
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Search currency..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ marginBottom: 12, backgroundColor: activeColors.surface }}
              left={<TextInput.Icon icon="magnify" />}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
              textColor={activeColors.text}
              theme={{ colors: { background: activeColors.surface } }}
            />
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {filteredCurrencies.map((c) => (
                <List.Item
                  key={c.code}
                  title={`${c.name} (${c.code})`}
                  description={`Format: ${c.symbol} 1,234.56`}
                  left={(props) => (
                    <View style={{ width: 40, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 20, color: activeColors.text, fontWeight: 'bold' }}>
                        {c.symbol}
                      </Text>
                    </View>
                  )}
                  right={(props) =>
                    currencyPref === c.code ? (
                      <List.Icon {...props} icon="check" color={activeColors.primary} />
                    ) : null
                  }
                  onPress={() => {
                    setCurrencyPref(c.code);
                    setShowCurrencyModal(false);
                    setSearchQuery("");
                  }}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: activeColors.border,
                  }}
                  titleStyle={{ color: activeColors.text }}
                  descriptionStyle={{ color: activeColors.textSecondary }}
                />
              ))}
            </ScrollView>
          </View>
        </SlideUpModal>
      </View>
    );
  }

  // Welcome Step / Offline Name dialog step
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
        {authLoading || googleLoading ? (
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
          visible={step === 'OFFLINE_NAME'}
          onDismiss={() => setStep('WELCOME')}
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
              onPress={() => setStep('WELCOME')}
              labelStyle={{ color: activeColors.textSecondary }}
            >
              Cancel
            </Button>
            <Button
              onPress={handleOfflineNameNext}
              labelStyle={{ color: activeColors.primary, fontWeight: "bold" }}
            >
              Next
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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
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
  currencyLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  currencySelector: {
    width: "100%",
    marginBottom: 20,
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
