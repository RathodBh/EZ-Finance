import React from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  Text,
  List,
  Avatar,
  Button,
  Card,
  Divider,
  TextInput,
} from "react-native-paper";
import { useAppStore } from "../store/appStore";
import { ThemeColors } from "../styles/theme";
import { NotificationService } from "../services/notificationService";
import { CURRENCIES } from "../services/utils";
import SlideUpModal from "../components/SlideUpModal";
import PremiumSwitch from "../components/PremiumSwitch";
import Papa from "papaparse";
import { Platform } from "react-native";

let Sharing: any = null;
let FileSystem: any = null;

if (Platform.OS !== "web") {
  try {
    Sharing = require("expo-sharing");
    FileSystem = require("expo-file-system");
  } catch (e) {
    console.warn("Native sharing modules failed to load:", e);
  }
}

import { useRouter } from "expo-router";

const Wrapper = ({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip?: string;
}) => {
  if (Platform.OS === "web" && tooltip) {
    return <div title={tooltip}>{children}</div>;
  }
  return <>{children}</>;
};

export default function MoreScreen() {
  const router = useRouter();
  const {
    user,
    logout,
    theme,
    toggleTheme,
    triggerSync,
    syncLoading,
    lastSyncTime,
    transactions,
    refreshAllData,
    autoSyncEnabled,
    toggleAutoSync,
    connectGoogleAccount,
    currency,
    setCurrency,
    notificationsEnabled,
    toggleNotifications,
  } = useAppStore();

  const activeColors = ThemeColors[theme];

  const [showCurrencyModal, setShowCurrencyModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredCurrencies = React.useMemo(() => {
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleExportCSV = async () => {
    try {
      if (transactions.length === 0) {
        Alert.alert("No Data", "There are no transactions to export.");
        return;
      }

      // Convert transactions to CSV payload
      const csvData = transactions.map((t) => ({
        ID: t.id,
        Date: new Date(t.date).toISOString().split("T")[0],
        Amount: t.amount,
        Type: t.type,
        Note: t.note || "",
        Merchant: t.merchant || "",
        PaymentMethod: t.paymentMethod || "",
        Tags: t.tags || "",
      }));

      const csvString = Papa.unparse(csvData);

      if (Platform.OS === "web") {
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "ezfinance_transactions.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}ezfinance_transactions.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvString);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export Transactions CSV",
        });
      } else {
        Alert.alert(
          "Export Failed",
          "Sharing mechanism is not available on this device.",
        );
      }
    } catch (err: any) {
      Alert.alert("Error", `Failed to export CSV: ${err.message}`);
    }
  };

  const handleExportJSON = async () => {
    try {
      if (transactions.length === 0) {
        Alert.alert("No Data", "There are no transactions to backup.");
        return;
      }

      const backupString = JSON.stringify(transactions, null, 2);

      if (Platform.OS === "web") {
        const blob = new Blob([backupString], {
          type: "application/json;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "ezfinance_backup.json");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}ezfinance_backup.json`;
      await FileSystem.writeAsStringAsync(fileUri, backupString);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Export Transactions JSON Backup",
        });
      } else {
        Alert.alert(
          "Export Failed",
          "Sharing mechanism is not available on this device.",
        );
      }
    } catch (err: any) {
      Alert.alert("Error", `Failed to export JSON backup: ${err.message}`);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      if (Platform.OS === "web") {
        const confirmConnect = window.confirm(
          "Connect Google Account\n\nWould you like to connect your Google account? All existing offline data will be uploaded and synced to your Google Drive.",
        );
        if (!confirmConnect) return;
      } else {
        const userClicked = await new Promise((resolve) => {
          Alert.alert(
            "Connect Google Account",
            "Would you like to connect your Google account? All existing offline data will be uploaded and synced to your Google Drive.",
            [
              {
                text: "Cancel",
                onPress: () => resolve(false),
                style: "cancel",
              },
              { text: "Connect", onPress: () => resolve(true) },
            ],
          );
        });
        if (!userClicked) return;
      }

      await connectGoogleAccount();
      Alert.alert(
        "Success",
        "Google account connected successfully and data migrated!",
      );
    } catch (err: any) {
      console.error("Failed to connect Google account:", err);
      Alert.alert(
        "Connection Failed",
        "Unable to authenticate with Google. Please try again.",
      );
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return "Never";
    return new Date(lastSyncTime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: activeColors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: activeColors.text }]}>
        Settings & Tools
      </Text>

      {/* User profile section */}
      {user && (
        <Card
          style={[
            styles.profileCard,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Card.Content style={styles.profileContent}>
            {user.id === "offline_user" ? (
              <Avatar.Text
                size={56}
                label={(user.name || "O")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()}
                style={{ backgroundColor: activeColors.primary }}
                labelStyle={{
                  color: activeColors.background,
                  fontWeight: "bold",
                }}
              />
            ) : (
              <Avatar.Image
                size={56}
                source={{
                  uri:
                    user.photoUrl ||
                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150",
                }}
              />
            )}
            <View style={styles.profileMeta}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <Text
                  style={[styles.profileName, { color: activeColors.text }]}
                >
                  {user.name}
                </Text>
                {user.id === "offline_user" && (
                  <View
                    style={{
                      backgroundColor: "rgba(226, 184, 92, 0.15)",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: activeColors.primary,
                    }}
                  >
                    <Text
                      style={{
                        color: activeColors.primary,
                        fontSize: 9,
                        fontWeight: "bold",
                        letterSpacing: 0.5,
                      }}
                    >
                      LOCAL VAULT
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.profileEmail,
                  { color: activeColors.textSecondary },
                ]}
              >
                {user.id === "offline_user"
                  ? "Offline Mode • Data saved on device"
                  : user.email}
              </Text>
            </View>
          </Card.Content>
          {user.id === "offline_user" && (
            <Card.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Button
                mode="contained"
                icon="google"
                onPress={handleConnectGoogle}
                style={{ flex: 1, backgroundColor: activeColors.primary }}
                labelStyle={{
                  color: activeColors.background,
                  fontWeight: "bold",
                }}
              >
                Connect Google Account
              </Button>
            </Card.Actions>
          )}
        </Card>
      )}

      {/* Synchronisation Panel */}
      <List.Section
        title="Cloud Synchronization"
        titleStyle={{ color: activeColors.primary, fontWeight: "bold" }}
      >
        <List.Item
          title="Google Drive Sync"
          description={
            !user || user.id === "offline_user"
              ? "Connect your Google account to enable sync"
              : `Last synced: ${formatLastSync()}`
          }
          left={(props) => (
            <List.Icon
              {...props}
              icon="cloud-sync-outline"
              color={activeColors.text}
            />
          )}
          right={() => (
            <View style={{ justifyContent: "center", paddingRight: 4 }}>
              <Button
                mode="outlined"
                compact
                loading={syncLoading}
                onPress={() => triggerSync()}
                style={{ borderColor: activeColors.primary }}
                labelStyle={{
                  color: activeColors.primary,
                  fontSize: 13,
                  fontWeight: "bold",
                }}
              >
                {!user || user.id === "offline_user" ? "Connect" : "Sync"}
              </Button>
            </View>
          )}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <Wrapper
          tooltip={
            !user || user.id === "offline_user"
              ? "You must login with google first!"
              : undefined
          }
        >
          <List.Item
            title="Auto Sync"
            description={
              !user || user.id === "offline_user"
                ? "You must login with google first!"
                : "Automatically sync data in the background"
            }
            left={(props) => (
              <List.Icon
                {...props}
                icon="sync"
                color={
                  !user || user.id === "offline_user"
                    ? activeColors.textSecondary
                    : activeColors.text
                }
              />
            )}
            right={() => (
              <View style={{ justifyContent: "center" }}>
                <PremiumSwitch
                  value={autoSyncEnabled}
                  disabled={!user || user.id === "offline_user"}
                  onValueChange={toggleAutoSync}
                  activeColor={activeColors.primary}
                  inactiveColor={theme === 'dark' ? '#3e3e3e' : '#e0e0e0'}
                />
              </View>
            )}
            style={[
              styles.listItem,
              {
                backgroundColor: activeColors.surface,
                borderColor: activeColors.border,
                opacity: !user || user.id === "offline_user" ? 0.6 : 1,
              },
            ]}
            titleStyle={{
              color:
                !user || user.id === "offline_user"
                  ? activeColors.textSecondary
                  : activeColors.text,
            }}
            descriptionStyle={{
              color:
                !user || user.id === "offline_user"
                  ? activeColors.error
                  : activeColors.textSecondary,
            }}
          />
        </Wrapper>
      </List.Section>

      {/* General Settings */}
      <List.Section
        title="Preferences"
        titleStyle={{ color: activeColors.primary, fontWeight: "bold" }}
      >
        <List.Item
          title="Dark Theme"
          description="Sleek dark layout configuration"
          left={(props) => (
            <List.Icon
              {...props}
              icon="brightness-4"
              color={activeColors.text}
            />
          )}
          right={() => (
            <PremiumSwitch
              value={theme === "dark"}
              onValueChange={toggleTheme}
              activeColor={activeColors.primary}
              inactiveColor={theme === 'dark' ? '#3e3e3e' : '#e0e0e0'}
            />
          )}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <List.Item
          title="Primary Currency"
          description="Select global formatting currency"
          left={(props) => (
            <List.Icon
              {...props}
              icon="cash-multiple"
              color={activeColors.text}
            />
          )}
          right={(props) => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  color: activeColors.primary,
                  marginRight: 4,
                  fontWeight: "bold",
                }}
              >
                {currency}
              </Text>
              <List.Icon
                {...props}
                icon="chevron-down"
                color={activeColors.textSecondary}
              />
            </View>
          )}
          onPress={() => setShowCurrencyModal(true)}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <List.Item
          title="Transaction Reminders"
          description="Daily notifications to log transactions"
          left={(props) => (
            <List.Icon
              {...props}
              icon="bell-outline"
              color={activeColors.text}
            />
          )}
          right={() => (
            <PremiumSwitch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              activeColor={activeColors.primary}
              inactiveColor={theme === 'dark' ? '#3e3e3e' : '#e0e0e0'}
            />
          )}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <List.Item
          title="Send Test Notification"
          description="Trigger an immediate test alert (2s delay)"
          left={(props) => (
            <List.Icon
              {...props}
              icon="alert-circle-outline"
              color={activeColors.text}
            />
          )}
          onPress={async () => {
            await NotificationService.sendTestNotification();
          }}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />
      </List.Section>

      {/* Reorganized Section 2: Data Management */}
      <List.Section
        title="Data & Structure"
        titleStyle={{ color: activeColors.primary, fontWeight: "bold" }}
      >
        <List.Item
          title="Manage Categories"
          description="Edit and organize category tree"
          left={(props) => (
            <List.Icon
              {...props}
              icon="folder-outline"
              color={activeColors.text}
            />
          )}
          onPress={() => router.push("/manage-categories")}
          right={(props) => (
            <List.Icon
              {...props}
              icon="chevron-right"
              color={activeColors.textSecondary}
            />
          )}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <List.Item
          title="Manage Accounts"
          description="Create, edit, and delete cash, bank, or card accounts"
          left={(props) => (
            <List.Icon
              {...props}
              icon="wallet-outline"
              color={activeColors.text}
            />
          )}
          onPress={() => router.push("/manage-accounts")}
          right={(props) => (
            <List.Icon
              {...props}
              icon="chevron-right"
              color={activeColors.textSecondary}
            />
          )}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />
      </List.Section>

      {/* Import / Export tools */}
      <List.Section
        title="Data Utilities"
        titleStyle={{ color: activeColors.primary, fontWeight: "bold" }}
      >
        <List.Item
          title="Export CSV spreadsheet"
          description="Export all transactions in CSV structure"
          left={(props) => (
            <List.Icon
              {...props}
              icon="file-delimited-outline"
              color={activeColors.text}
            />
          )}
          onPress={handleExportCSV}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />

        <List.Item
          title="Export JSON Backup"
          description="Download database backup locally"
          left={(props) => (
            <List.Icon
              {...props}
              icon="database-export-outline"
              color={activeColors.text}
            />
          )}
          onPress={handleExportJSON}
          style={[
            styles.listItem,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          titleStyle={{ color: activeColors.text }}
          descriptionStyle={{ color: activeColors.textSecondary }}
        />
      </List.Section>

      {/* Session Management */}
      <Button
        mode="contained"
        icon="logout"
        onPress={logout}
        style={[styles.logoutBtn, { backgroundColor: activeColors.error }]}
        labelStyle={{ color: "#fff", fontWeight: "bold" }}
      >
        Sign Out Vault
      </Button>

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
                currency === c.code ? (
                  <List.Icon {...props} icon="check" color={activeColors.primary} />
                ) : null
              }
              onPress={async () => {
                await setCurrency(c.code);
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
  },
  profileCard: {
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  profileMeta: {
    marginLeft: 16,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  profileEmail: {
    fontSize: 13,
  },
  listItem: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingVertical: 4,
  },
  logoutBtn: {
    borderRadius: 14,
    marginTop: 35,
    height: 50,
    justifyContent: "center",
  },
});
