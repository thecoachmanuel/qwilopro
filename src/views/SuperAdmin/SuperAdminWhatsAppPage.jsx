import React, { useState, useEffect, useRef } from "react";
import Page from "../../components/Page";
import {
  IconBrandWhatsapp,
  IconQrcode,
  IconCheck,
  IconX,
  IconRefresh,
  IconUpload,
  IconFileSpreadsheet,
  IconUsers,
  IconUserPlus,
  IconSend,
  IconTrash,
  IconInfoCircle,
  IconLink,
  IconCopy,
  IconDeviceMobile,
  IconWifi,
  IconWifiOff,
  IconSearch,
  IconSparkles,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconCircleCheck,
  IconAlertCircle,
  IconExternalLink,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import { toast } from "react-hot-toast";
import { useTheme } from "../../contexts/ThemeContext";
import { clsx } from "clsx";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  getWhatsAppStatus,
  getWhatsAppQR,
  connectWhatsApp,
  disconnectWhatsApp,
  uploadLeads,
  saveLeadBatch,
  getSavedLeads,
  deleteSavedLeadBatch,
  getWhatsAppGroups,
  createWhatsAppGroup,
  addContactsToWhatsAppGroup,
  sendWhatsAppBroadcast,
  getGatewayInfo,
} from "../../controllers/whatsapp.controller";

const NECTAR_GROUP_CODE = [
  "// POST /sessions/:sessionId/groups/create",
  'app.post("/sessions/:sessionId/groups/create", auth, async (req, res) => {',
  "  const { sessionId } = req.params;",
  "  const { name, phones } = req.body;",
  "  const session = tenantSessions.get(sessionId);",
  '  if (!session || !session.sock || session.connectionStatus !== "open") {',
  '    return res.status(400).json({ status: false, message: "WhatsApp not connected." });',
  "  }",
  "  try {",
  '    const participants = (phones || []).map((p) => String(p).replace(/\\D/g, "") + "@s.whatsapp.net");',
  "    const group = await session.sock.groupCreate(name, participants);",
  "    let inviteCode = null;",
  "    try { inviteCode = await session.sock.groupInviteCode(group.id); } catch (_) {}",
  "    res.json({",
  "      status: true,",
  "      group: {",
  "        id: group.id,",
  "        subject: group.subject,",
  "        inviteCode,",
  '        inviteLink: inviteCode ? "https://chat.whatsapp.com/" + inviteCode : null,',
  "      },",
  "    });",
  "  } catch (err) {",
  "    res.status(500).json({ status: false, message: err.message });",
  "  }",
  "});",
].join("\n");

export default function SuperAdminWhatsAppPage() {

  const { theme } = useTheme();

  // ─── Connection States ──────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // open, connecting, disconnected
  const [isConnected, setIsConnected] = useState(false);
  const [qrCodeImg, setQrCodeImg] = useState(null);
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [gatewayInfo, setGatewayInfo] = useState(null);

  // ─── Lead Management States ─────────────────────────────────────────────────
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [leadsStats, setLeadsStats] = useState({ total: 0, duplicates: 0, invalid: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [batchName, setBatchName] = useState("");
  const [savedBatches, setSavedBatches] = useState([]);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const fileInputRef = useRef(null);

  // ─── Group & Broadcast States ───────────────────────────────────────────────
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [existingGroupId, setExistingGroupId] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState(
    "Hello! Join our official Qwilo Pro VIP community here: "
  );
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingContacts, setIsAddingContacts] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(null);
  const [activeTab, setActiveTab] = useState("connect"); // connect, leads, groups, broadcast, guide
  const [createdGroups, setCreatedGroups] = useState([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Polling ref for QR and connection status
  const pollTimerRef = useRef(null);

  // ─── Initial Load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStatus();
    loadSavedBatches();
    loadGatewayInfo();
    loadGroups();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Poll status when in connecting state
  useEffect(() => {
    if (connectionStatus === "connecting" || (!isConnected && qrCodeImg)) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        checkStatusSilently();
      }, 3500);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [connectionStatus, isConnected, qrCodeImg]);

  // ─── Status & QR Operations ─────────────────────────────────────────────────
  const fetchStatus = async () => {
    setIsStatusLoading(true);
    try {
      const res = await getWhatsAppStatus();
      if (res?.success) {
        const data = res.data;
        const connected = !!(data?.connected || data?.connection === "open");
        setIsConnected(connected);
        setConnectionStatus(connected ? "open" : data?.connection || "disconnected");
        setPhoneInfo(data?.phone || null);

        if (!connected && (data?.qrReady || data?.connection === "connecting")) {
          fetchQR();
        } else if (connected) {
          setQrCodeImg(null);
        }
      }
    } catch (err) {
      console.warn("Status fetch warning:", err?.message);
    } finally {
      setIsStatusLoading(false);
    }
  };

  const checkStatusSilently = async () => {
    try {
      const res = await getWhatsAppStatus();
      if (res?.success) {
        const data = res.data;
        const connected = !!(data?.connected || data?.connection === "open");
        if (connected) {
          setIsConnected(true);
          setConnectionStatus("open");
          setPhoneInfo(data?.phone || null);
          setQrCodeImg(null);
          toast.success("Qwilo Pro WhatsApp connected successfully!");
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        } else if (!qrCodeImg && data?.qrReady) {
          fetchQR();
        }
      }
    } catch (_) {}
  };

  const fetchQR = async () => {
    setIsQrLoading(true);
    try {
      const res = await getWhatsAppQR();
      if (res?.success && res.data?.qr) {
        setQrCodeImg(res.data.qr);
        setConnectionStatus("connecting");
      }
    } catch (err) {
      console.warn("QR fetch warning:", err?.message);
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    toast.loading("Starting WhatsApp session & generating QR...");
    try {
      const res = await connectWhatsApp();
      toast.dismiss();
      toast.success(res?.message || "Session started. Fetching QR code...");
      setConnectionStatus("connecting");

      // Wait a moment for Baileys to output the QR string
      setTimeout(() => {
        fetchQR();
      }, 1500);
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to start WhatsApp session");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Qwilo Pro WhatsApp? You will need to scan QR again to reconnect.")) {
      return;
    }

    toast.loading("Disconnecting WhatsApp...");
    try {
      const res = await disconnectWhatsApp();
      toast.dismiss();
      toast.success(res?.message || "Disconnected successfully");
      setIsConnected(false);
      setConnectionStatus("disconnected");
      setQrCodeImg(null);
      setPhoneInfo(null);
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to disconnect");
    }
  };

  const loadGatewayInfo = async () => {
    try {
      const res = await getGatewayInfo();
      if (res?.success) {
        setGatewayInfo(res);
      }
    } catch (_) {}
  };

  const loadSavedBatches = async () => {
    try {
      const res = await getSavedLeads();
      if (res?.success) {
        setSavedBatches(res.batches || []);
      }
    } catch (_) {}
  };

  const loadGroups = async () => {
    try {
      const res = await getWhatsAppGroups();
      if (res?.success) {
        setCreatedGroups(res.groups || []);
      }
    } catch (_) {}
  };

  // ─── File Upload & Lead Extraction ──────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsUploading(true);

    const isCsv = file.name.endsWith(".csv");
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isCsv) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          if (!results.data || results.data.length < 2) {
            toast.error("File is empty or has only headers");
            setIsUploading(false);
            return;
          }
          const headers = results.data[0];
          const rows = results.data.slice(1);
          await processLeadsData(headers, rows);
        },
        error: (err) => {
          toast.error("Error reading CSV: " + err.message);
          setIsUploading(false);
        },
      });
    } else if (isXlsx) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (!data || data.length < 2) {
            toast.error("Excel sheet is empty or contains only headers");
            setIsUploading(false);
            return;
          }

          const headers = data[0];
          const rows = data.slice(1);
          await processLeadsData(headers, rows);
        } catch (err) {
          toast.error("Error reading Excel: " + err.message);
          setIsUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Please upload a .csv or .xlsx file");
      setIsUploading(false);
    }
  };

  const processLeadsData = async (headers, rows) => {
    try {
      const res = await uploadLeads({ headers, rows });
      if (res?.success) {
        setExtractedLeads(res.leads);
        // Select all by default
        setSelectedLeadIds(new Set(res.leads.map((l) => l.id)));
        setLeadsStats({
          total: res.count,
          duplicates: res.duplicatesRemoved,
          invalid: res.invalidCount,
        });
        toast.success(res.message);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to process lead file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleLeadSelection = (id) => {
    const updated = new Set(selectedLeadIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedLeadIds(updated);
  };

  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const handleSaveBatch = async () => {
    if (!batchName.trim()) {
      toast.error("Please enter a name for this lead list");
      return;
    }
    if (extractedLeads.length === 0) {
      toast.error("No leads to save");
      return;
    }

    setIsSavingBatch(true);
    try {
      const res = await saveLeadBatch({
        name: batchName,
        leads: extractedLeads,
      });
      if (res?.success) {
        toast.success(res.message);
        setBatchName("");
        loadSavedBatches();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save lead batch");
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleLoadBatch = (batch) => {
    setExtractedLeads(batch.leads);
    setSelectedLeadIds(new Set(batch.leads.map((l) => l.id)));
    setLeadsStats({
      total: batch.leads.length,
      duplicates: 0,
      invalid: 0,
    });
    setUploadedFileName(batch.name);
    toast.success(`Loaded "${batch.name}" with ${batch.leads.length} contacts.`);
    setActiveTab("leads");
  };

  const handleDeleteBatch = async (id) => {
    if (!window.confirm("Are you sure you want to delete this saved list?")) return;
    try {
      const res = await deleteSavedLeadBatch(id);
      if (res?.success) {
        toast.success("Batch deleted");
        loadSavedBatches();
      }
    } catch (err) {
      toast.error("Failed to delete batch");
    }
  };

  // ─── Group & Broadcast Operations ───────────────────────────────────────────
  const getSelectedPhones = () => {
    return extractedLeads
      .filter((l) => selectedLeadIds.has(l.id))
      .map((l) => l.phone);
  };

  const handleCreateGroup = async () => {
    if (!isConnected) {
      toast.error("Please connect your Qwilo Pro WhatsApp number first!");
      setActiveTab("connect");
      return;
    }

    if (!groupName.trim()) {
      toast.error("Please enter a Group Name");
      return;
    }

    const phones = getSelectedPhones();
    if (phones.length === 0) {
      toast.error("Please select at least 1 lead to add to the group");
      return;
    }

    setIsCreatingGroup(true);
    toast.loading(`Creating WhatsApp group "${groupName}"...`);
    try {
      const res = await createWhatsAppGroup({
        name: groupName,
        phones,
        description: groupDescription,
      });
      toast.dismiss();
      if (res?.success) {
        toast.success(res.message);
        setGroupName("");
        setGroupDescription("");
        loadGroups();
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to create group");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleAddToExistingGroup = async () => {
    if (!isConnected) {
      toast.error("Please connect your Qwilo Pro WhatsApp number first!");
      setActiveTab("connect");
      return;
    }

    if (!existingGroupId.trim()) {
      toast.error("Please provide the Group ID or select an existing group");
      return;
    }

    const phones = getSelectedPhones();
    if (phones.length === 0) {
      toast.error("Please select at least 1 lead to add");
      return;
    }

    setIsAddingContacts(true);
    toast.loading(`Adding ${phones.length} contacts to group...`);
    try {
      const res = await addContactsToWhatsAppGroup({
        groupId: existingGroupId,
        phones,
      });
      toast.dismiss();
      if (res?.success) {
        toast.success("Contacts added to group successfully!");
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to add contacts to group");
    } finally {
      setIsAddingContacts(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!isConnected) {
      toast.error("Please connect your Qwilo Pro WhatsApp number first!");
      setActiveTab("connect");
      return;
    }

    if (!broadcastMessage.trim()) {
      toast.error("Please enter a message to broadcast");
      return;
    }

    const phones = getSelectedPhones();
    if (phones.length === 0) {
      toast.error("Please select at least 1 recipient from your leads list");
      return;
    }

    if (!window.confirm(`Are you sure you want to send this WhatsApp message to ${phones.length} contact(s)?`)) {
      return;
    }

    setIsBroadcasting(true);
    setBroadcastProgress({ sent: 0, total: phones.length, status: "Sending..." });
    toast.loading(`Dispatching WhatsApp broadcast to ${phones.length} contacts...`);

    try {
      const res = await sendWhatsAppBroadcast({
        phones,
        message: broadcastMessage,
        minDelayMs: 2500,
        maxDelayMs: 4500,
      });
      toast.dismiss();

      if (res?.success) {
        toast.success(res.message);
        setBroadcastProgress({
          sent: res.sentCount,
          total: res.total,
          status: `Completed: ${res.sentCount} sent, ${res.failedCount} failed`,
        });
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.message || "Failed to send broadcast");
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Filtered leads
  const filteredLeads = extractedLeads.filter((l) => {
    if (!leadSearchQuery) return true;
    const q = leadSearchQuery.toLowerCase();
    return (
      l.name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.rawPhone?.includes(q)
    );
  });

  return (
    <Page className="px-3 sm:px-6 py-4 overflow-x-hidden h-full pb-20">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 mt-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconBrandWhatsapp stroke={iconStroke} size={24} />
            </div>
            <h1 className="text-2xl font-bold text-restro-text dark:text-white">
              Qwilo Pro WhatsApp Marketing
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Connect your official Qwilo Pro WhatsApp number, extract leads from Excel/CSV, create groups, and broadcast invite links.
          </p>
        </div>

        {/* Status Pill & Action Buttons */}
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all",
              {
                "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800":
                  isConnected,
                "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800":
                  connectionStatus === "connecting" && !isConnected,
                "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800":
                  !isConnected && connectionStatus !== "connecting",
              }
            )}
          >
            <span
              className={clsx("w-2 h-2 rounded-full", {
                "bg-emerald-500 animate-pulse": isConnected,
                "bg-amber-500 animate-ping": connectionStatus === "connecting" && !isConnected,
                "bg-rose-500": !isConnected && connectionStatus !== "connecting",
              })}
            />
            {isConnected
              ? `Connected${phoneInfo ? ` (+${phoneInfo})` : ""}`
              : connectionStatus === "connecting"
              ? "Scanning Required"
              : "Not Connected"}
          </div>

          <button
            onClick={fetchStatus}
            disabled={isStatusLoading}
            className="p-2 border border-restro-border-green rounded-xl hover:bg-restro-green-light dark:hover:bg-restro-gray text-restro-text dark:text-white transition"
            title="Refresh Connection Status"
          >
            <IconRefresh
              stroke={iconStroke}
              size={18}
              className={clsx({ "animate-spin": isStatusLoading })}
            />
          </button>
        </div>
      </div>

      {/* ─── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-restro-border-green dark:border-restro-border-green mb-6 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab("connect")}
          className={clsx(
            "flex items-center gap-2 py-3 px-4 font-medium text-sm transition-all border-b-2 whitespace-nowrap",
            activeTab === "connect"
              ? "border-restro-green text-restro-green font-semibold"
              : "border-transparent text-gray-500 hover:text-restro-text dark:hover:text-white"
          )}
        >
          <IconDeviceMobile stroke={iconStroke} size={18} />
          WhatsApp Connection {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
        </button>

        <button
          onClick={() => setActiveTab("leads")}
          className={clsx(
            "flex items-center gap-2 py-3 px-4 font-medium text-sm transition-all border-b-2 whitespace-nowrap",
            activeTab === "leads"
              ? "border-restro-green text-restro-green font-semibold"
              : "border-transparent text-gray-500 hover:text-restro-text dark:hover:text-white"
          )}
        >
          <IconFileSpreadsheet stroke={iconStroke} size={18} />
          Lead Extractor & Contacts{" "}
          {extractedLeads.length > 0 && (
            <span className="text-xs bg-restro-green text-white rounded-full px-2 py-0.2">
              {extractedLeads.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("groups")}
          className={clsx(
            "flex items-center gap-2 py-3 px-4 font-medium text-sm transition-all border-b-2 whitespace-nowrap",
            activeTab === "groups"
              ? "border-restro-green text-restro-green font-semibold"
              : "border-transparent text-gray-500 hover:text-restro-text dark:hover:text-white"
          )}
        >
          <IconUsers stroke={iconStroke} size={18} />
          WhatsApp Groups
        </button>

        <button
          onClick={() => setActiveTab("broadcast")}
          className={clsx(
            "flex items-center gap-2 py-3 px-4 font-medium text-sm transition-all border-b-2 whitespace-nowrap",
            activeTab === "broadcast"
              ? "border-restro-green text-restro-green font-semibold"
              : "border-transparent text-gray-500 hover:text-restro-text dark:hover:text-white"
          )}
        >
          <IconSend stroke={iconStroke} size={18} />
          Broadcast & Invite Sender
        </button>
      </div>

      {/* ─── TAB 1: WhatsApp Device Connection ───────────────────────────────── */}
      {activeTab === "connect" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Device Info & Actions */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-restro-text dark:text-white mb-2 flex items-center gap-2">
                <IconBrandWhatsapp className="text-emerald-500" stroke={iconStroke} />
                Connect Qwilo Pro WhatsApp Number
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Link your dedicated business phone to manage group additions and send automated WhatsApp campaigns.
              </p>

              {/* Status Banner */}
              <div
                className={clsx(
                  "p-4 rounded-xl border mb-6 flex items-start gap-3",
                  isConnected
                    ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : "bg-gray-50 dark:bg-restro-gray/40 border-restro-border-green"
                )}
              >
                {isConnected ? (
                  <IconCircleCheck className="text-emerald-500 mt-0.5 flex-shrink-0" size={22} stroke={iconStroke} />
                ) : (
                  <IconAlertCircle className="text-amber-500 mt-0.5 flex-shrink-0" size={22} stroke={iconStroke} />
                )}
                <div>
                  <h4 className="font-semibold text-sm text-restro-text dark:text-white">
                    {isConnected ? "Qwilo Pro WhatsApp Active" : "No WhatsApp Device Connected"}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {isConnected
                      ? "Your WhatsApp session is authenticated. You can now create groups and broadcast messages."
                      : "Scan the QR code on the right with WhatsApp on your phone (Linked Devices)."}
                  </p>
                  {phoneInfo && (
                    <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                      Phone: +{phoneInfo}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="bg-restro-green hover:bg-restro-green-dark text-white rounded-xl py-2.5 px-5 font-medium transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <IconQrcode stroke={iconStroke} size={18} />
                    {isConnecting ? "Generating QR Code..." : "Connect WhatsApp / Generate QR"}
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    className="border border-rose-300 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl py-2.5 px-5 font-medium transition flex items-center gap-2"
                  >
                    <IconWifiOff stroke={iconStroke} size={18} />
                    Disconnect WhatsApp
                  </button>
                )}

                <button
                  onClick={fetchQR}
                  disabled={isQrLoading || isConnected}
                  className="border border-restro-border-green hover:bg-restro-green-light dark:hover:bg-restro-gray text-restro-text dark:text-white rounded-xl py-2.5 px-4 font-medium transition flex items-center gap-2 disabled:opacity-40"
                >
                  <IconRefresh stroke={iconStroke} size={18} className={clsx({ "animate-spin": isQrLoading })} />
                  Refresh QR
                </button>
              </div>

              {/* Gateway Configuration Info */}
              <div className="mt-6 pt-5 border-t border-restro-border-green/60">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Gateway Details
                </p>
                <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-400">Service:</span>
                    <span className="font-mono font-medium">Nectar Baileys Gateway</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-400">URL:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 truncate max-w-[220px]">
                      {gatewayInfo?.gatewayUrl || "https://nectar-58qj.onrender.com"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-400">Session ID:</span>
                    <span className="font-mono font-medium">
                      {gatewayInfo?.sessionId || "qwilopro"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scanning Instructions */}
            <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-sm text-restro-text dark:text-white mb-3 flex items-center gap-2">
                <IconInfoCircle size={18} className="text-restro-green" />
                How to Link Your WhatsApp Phone
              </h3>
              <ol className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300 list-decimal list-inside">
                <li>Open <strong>WhatsApp</strong> on your Qwilo Pro business smartphone.</li>
                <li>Tap <strong>Settings</strong> (iOS) or <strong>Menu ⋮</strong> (Android) in the top corner.</li>
                <li>Tap <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.</li>
                <li>Point your camera at the QR code on this screen.</li>
                <li>The page will automatically update once authenticated!</li>
              </ol>
            </div>
          </div>

          {/* Right Column: Live QR Code Display */}
          <div className="lg:col-span-6">
            <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[460px] text-center">
              {isConnected ? (
                <div className="flex flex-col items-center py-10">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                    <IconCheck stroke={iconStroke} size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-restro-text dark:text-white mb-1">
                    WhatsApp Connected!
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                    Your Qwilo Pro WhatsApp session is live and ready to perform marketing actions.
                  </p>
                  <button
                    onClick={() => setActiveTab("leads")}
                    className="bg-restro-green hover:bg-restro-green-dark text-white rounded-xl py-2.5 px-6 font-medium transition flex items-center gap-2"
                  >
                    <IconFileSpreadsheet stroke={iconStroke} size={18} />
                    Extract Leads & Upload File
                  </button>
                </div>
              ) : qrCodeImg ? (
                <div className="flex flex-col items-center">
                  <div className="relative p-4 bg-white rounded-2xl border-2 border-dashed border-emerald-400 shadow-md mb-4">
                    <img
                      src={qrCodeImg}
                      alt="WhatsApp Web QR Code"
                      className="w-64 h-64 object-contain rounded-lg"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                      Live
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                    <IconClock size={14} className="text-amber-500 animate-spin" />
                    Waiting for scan from Qwilo Pro phone...
                  </p>
                  <button
                    onClick={fetchQR}
                    disabled={isQrLoading}
                    className="text-xs text-restro-green hover:underline flex items-center gap-1"
                  >
                    <IconRefresh size={14} /> Refresh QR Code if expired
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-12">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-restro-gray text-gray-400 flex items-center justify-center mb-4">
                    <IconQrcode stroke={iconStroke} size={40} />
                  </div>
                  <h3 className="text-lg font-bold text-restro-text dark:text-white mb-2">
                    QR Code Not Generated
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
                    Click the button below to initialize the WhatsApp session and generate the scan QR code.
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="bg-restro-green hover:bg-restro-green-dark text-white rounded-xl py-2.5 px-6 font-medium transition flex items-center gap-2"
                  >
                    <IconQrcode stroke={iconStroke} size={18} />
                    {isConnecting ? "Generating..." : "Generate WhatsApp QR"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Lead Extractor & Contacts ────────────────────────────────── */}
      {activeTab === "leads" && (
        <div className="space-y-6">
          {/* Upload Box */}
          <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-restro-text dark:text-white mb-2 flex items-center gap-2">
              <IconFileSpreadsheet className="text-emerald-500" stroke={iconStroke} />
              Upload Lead File (CSV / Excel)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Upload any customer or lead spreadsheet. The system automatically scans columns for phone numbers, cleans international formats, and eliminates duplicates.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="flex-1 w-full flex items-center justify-center border-2 border-dashed border-restro-border-green rounded-xl p-6 cursor-pointer hover:bg-restro-green-light/40 dark:hover:bg-restro-gray/40 transition">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2 text-center">
                  <IconUpload stroke={iconStroke} size={32} className="text-restro-green" />
                  <span className="text-sm font-medium text-restro-text dark:text-white">
                    {isUploading
                      ? "Processing spreadsheet..."
                      : uploadedFileName
                      ? `Selected: ${uploadedFileName}`
                      : "Click to select CSV or Excel file (.csv, .xlsx)"}
                  </span>
                  <span className="text-xs text-gray-400">
                    Supports columns named Phone, Mobile, WhatsApp, Name, Email
                  </span>
                </div>
              </label>

              {/* Saved Batches Dropdown / Selector */}
              {savedBatches.length > 0 && (
                <div className="w-full sm:w-72 bg-gray-50 dark:bg-restro-gray/30 p-4 rounded-xl border border-restro-border-green">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Saved Contact Lists ({savedBatches.length})
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {savedBatches.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-black border border-restro-border-green text-xs"
                      >
                        <button
                          onClick={() => handleLoadBatch(b)}
                          className="font-medium text-restro-text dark:text-white hover:text-restro-green truncate text-left flex-1"
                        >
                          {b.name} ({b.leadsCount})
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(b.id)}
                          className="text-gray-400 hover:text-rose-500 ml-2"
                          title="Delete list"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Extracted Stats */}
            {extractedLeads.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-restro-border-green">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {leadsStats.total}
                  </span>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-1">
                    Valid WhatsApp Numbers
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {leadsStats.duplicates}
                  </span>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-1">
                    Duplicates Filtered Out
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedLeadIds.size}
                  </span>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-1">
                    Contacts Selected
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Lead Table & Actions */}
          {extractedLeads.length > 0 && (
            <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-base text-restro-text dark:text-white">
                    Extracted Contacts ({extractedLeads.length})
                  </h3>
                  <button
                    onClick={toggleSelectAllLeads}
                    className="text-xs text-restro-green hover:underline font-medium"
                  >
                    {selectedLeadIds.size === filteredLeads.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* Search */}
                  <div className="relative flex-1 sm:w-60">
                    <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search name or phone..."
                      value={leadSearchQuery}
                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-restro-border-green rounded-xl bg-transparent dark:text-white focus:outline-none focus:ring-1 focus:ring-restro-green"
                    />
                  </div>

                  {/* Save Batch Form */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="List name (e.g. VIP Leads)..."
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      className="text-xs px-3 py-1.5 border border-restro-border-green rounded-xl bg-transparent dark:text-white focus:outline-none focus:ring-1 focus:ring-restro-green w-40"
                    />
                    <button
                      onClick={handleSaveBatch}
                      disabled={isSavingBatch || !batchName.trim()}
                      className="bg-restro-green hover:bg-restro-green-dark text-white rounded-xl py-1.5 px-3 text-xs font-medium transition disabled:opacity-50"
                    >
                      {isSavingBatch ? "Saving..." : "Save List"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-96 border border-restro-border-green rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-restro-gray/50 border-b border-restro-border-green sticky top-0">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                          onChange={toggleSelectAllLeads}
                          className="rounded text-restro-green focus:ring-restro-green"
                        />
                      </th>
                      <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Name</th>
                      <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Phone (Normalized)</th>
                      <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Original Phone</th>
                      <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredLeads.map((lead) => {
                      const isSelected = selectedLeadIds.has(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => toggleLeadSelection(lead.id)}
                          className={clsx(
                            "cursor-pointer hover:bg-restro-green-light/30 dark:hover:bg-restro-gray/30 transition",
                            isSelected && "bg-emerald-50/50 dark:bg-emerald-950/20"
                          )}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLeadSelection(lead.id)}
                              className="rounded text-restro-green focus:ring-restro-green"
                            />
                          </td>
                          <td className="p-3 font-medium text-restro-text dark:text-white">
                            {lead.name}
                          </td>
                          <td className="p-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {lead.displayPhone}
                          </td>
                          <td className="p-3 text-gray-500 dark:text-gray-400">
                            {lead.rawPhone}
                          </td>
                          <td className="p-3 text-gray-400">
                            {lead.email || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Jump to Groups/Broadcast */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-restro-border-green/60">
                <span className="text-xs text-gray-500">
                  {selectedLeadIds.size} of {extractedLeads.length} contacts selected
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab("groups")}
                    className="border border-restro-border-green hover:bg-restro-green-light dark:hover:bg-restro-gray text-restro-text dark:text-white rounded-xl py-2 px-4 text-xs font-medium transition flex items-center gap-2"
                  >
                    <IconUserPlus stroke={iconStroke} size={16} />
                    Add to WhatsApp Group
                  </button>
                  <button
                    onClick={() => setActiveTab("broadcast")}
                    className="bg-restro-green hover:bg-restro-green-dark text-white rounded-xl py-2 px-4 text-xs font-medium transition flex items-center gap-2"
                  >
                    <IconSend stroke={iconStroke} size={16} />
                    Send Broadcast / Invite
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: WhatsApp Group Management ────────────────────────────────── */}
      {activeTab === "groups" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Group Form */}
          <div className="lg:col-span-6 bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-restro-text dark:text-white mb-2 flex items-center gap-2">
                <IconUserPlus className="text-emerald-500" stroke={iconStroke} />
                Create New WhatsApp Group
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Create a new WhatsApp group under your Qwilo Pro account and add your selected leads as participants.
              </p>

              {/* Anti-Ban Shield Card */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 mb-5 flex items-start gap-2.5 text-xs">
                <IconSparkles size={18} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Anti-Ban Protection Enabled:
                  </span>{" "}
                  <span className="text-gray-600 dark:text-gray-300">
                    Contacts are added in micro-batches (3-4 leads) with randomized human pauses to protect your account. For cold leads with strict privacy settings, use the <strong>Broadcast & Invite</strong> tab to send invite links instead.
                  </span>
                </div>
              </div>


              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Group Name / Subject *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Qwilo Pro VIP Customers"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full border border-restro-border-green rounded-xl px-4 py-2.5 text-sm bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Group Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Official Qwilo Pro updates, exclusive offers and announcements..."
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    className="w-full border border-restro-border-green rounded-xl p-3 text-sm bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
                  />
                </div>

                {/* Selected Leads Counter */}
                <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-restro-gray/30 border border-restro-border-green flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300">
                    Selected Leads to Add:
                  </span>
                  <span className="font-bold text-restro-green text-sm">
                    {selectedLeadIds.size} contacts
                  </span>
                </div>

                {selectedLeadIds.size === 0 && (
                  <p className="text-xs text-amber-500">
                    Tip: Upload leads in the "Lead Extractor" tab first to select members.
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={isCreatingGroup || !groupName.trim() || selectedLeadIds.size === 0}
              className="mt-6 bg-restro-green hover:bg-restro-green-dark text-white rounded-xl py-3 px-6 font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <IconUsers stroke={iconStroke} size={18} />
              {isCreatingGroup ? "Creating Group..." : `Create Group & Add (${selectedLeadIds.size}) Leads`}
            </button>
          </div>

          {/* Add to Existing Group or View Created Groups */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            {/* Add to Existing */}
            <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-restro-text dark:text-white mb-2 flex items-center gap-2">
                <IconLink className="text-emerald-500" stroke={iconStroke} />
                Add to Existing WhatsApp Group
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Enter an existing Group ID / JID (e.g. 12036304...&#64;g.us) to append selected leads.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Group JID / Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12036302839482910@g.us"
                    value={existingGroupId}
                    onChange={(e) => setExistingGroupId(e.target.value)}
                    className="w-full border border-restro-border-green rounded-xl px-4 py-2.5 text-sm bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
                  />
                </div>

                <button
                  onClick={handleAddToExistingGroup}
                  disabled={isAddingContacts || !existingGroupId.trim() || selectedLeadIds.size === 0}
                  className="w-full border border-restro-border-green hover:bg-restro-green-light dark:hover:bg-restro-gray text-restro-text dark:text-white rounded-xl py-2.5 px-4 font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <IconUserPlus stroke={iconStroke} size={18} />
                  {isAddingContacts ? "Adding Contacts..." : `Add Selected (${selectedLeadIds.size}) to Group`}
                </button>
              </div>
            </div>

            {/* Created Groups List */}
            <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-restro-text dark:text-white">
                  Created / Registered Groups ({createdGroups.length})
                </h3>
                <button onClick={loadGroups} className="text-xs text-restro-green hover:underline">
                  Refresh
                </button>
              </div>

              {createdGroups.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">
                  No groups recorded yet. Create your first group using the form on the left.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {createdGroups.map((g, idx) => (
                    <div
                      key={g.id || idx}
                      className="p-3 rounded-xl border border-restro-border-green bg-gray-50 dark:bg-restro-gray/20 text-xs flex items-center justify-between"
                    >
                      <div>
                        <h5 className="font-semibold text-restro-text dark:text-white">{g.name}</h5>
                        <p className="text-gray-500 mt-0.5">
                          {g.participantsCount} contacts added • {new Date(g.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {g.inviteLink && (
                        <a
                          href={g.inviteLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-restro-green hover:underline flex items-center gap-1 font-medium"
                        >
                          <IconExternalLink size={14} /> Invite Link
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: Broadcast & Invite Sender ────────────────────────────────── */}
      {activeTab === "broadcast" && (
        <div className="bg-white dark:bg-black border border-restro-border-green rounded-2xl p-6 shadow-sm max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-restro-text dark:text-white mb-2 flex items-center gap-2">
            <IconSend className="text-emerald-500" stroke={iconStroke} />
            Broadcast WhatsApp Messages & Group Invites
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Send custom messages or WhatsApp group invite links directly to your selected leads from your connected Qwilo Pro business number.
          </p>

          <div className="space-y-4">
            {/* Anti-Ban Pacing Banner */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs">

              <IconSparkles size={18} className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Anti-Ban Smart Pacing Active:
                </span>{" "}
                <span className="text-gray-600 dark:text-gray-300">
                  Messages are automatically queued with human-like randomized delays (2.5s – 4.5s) and automatic cooldown breaks to keep your Qwilo Pro WhatsApp number completely safe from Meta spam filters.
                </span>
              </div>
            </div>

            {/* Recipient summary banner */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-restro-gray/40 border border-restro-border-green flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-restro-text dark:text-white">
                  Target Recipients:
                </span>{" "}
                <span className="font-bold text-restro-green">
                  {selectedLeadIds.size} lead(s) selected
                </span>
              </div>
              <button
                onClick={() => setActiveTab("leads")}
                className="text-restro-green hover:underline font-semibold"
              >
                Change Recipients
              </button>
            </div>



            {/* Message composer */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                WhatsApp Message Content *
              </label>
              <textarea
                rows={5}
                placeholder="Type your WhatsApp message or paste your WhatsApp Group invite link here..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full border border-restro-border-green rounded-xl p-3 text-sm bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green font-sans"
              />
              <p className="text-xs text-gray-400 mt-1">
                Tip: To invite people to a group, copy your WhatsApp Group invite link (e.g.{" "}
                <span className="font-mono text-emerald-600">https://chat.whatsapp.com/XXXXX</span>) into the message.
              </p>
            </div>

            {/* Progress Display */}
            {broadcastProgress && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-restro-gray/40 border border-restro-border-green text-xs space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Broadcast Status:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {broadcastProgress.sent} / {broadcastProgress.total} sent
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-restro-green h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        broadcastProgress.total > 0
                          ? (broadcastProgress.sent / broadcastProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-gray-500 dark:text-gray-400">{broadcastProgress.status}</p>
              </div>
            )}

            <button
              onClick={handleSendBroadcast}
              disabled={isBroadcasting || !broadcastMessage.trim() || selectedLeadIds.size === 0}
              className="w-full bg-restro-green hover:bg-restro-green-dark text-white rounded-xl py-3 px-6 font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <IconSend stroke={iconStroke} size={18} />
              {isBroadcasting
                ? "Sending WhatsApp Broadcast..."
                : `Send to ${selectedLeadIds.size} Selected Contact(s)`}
            </button>
          </div>
        </div>
      )}

      {/* ─── Expandable Guide / Nectar Gateway Code Reference ────────────────── */}
      <div className="mt-8 border-t border-restro-border-green/80 pt-6">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-restro-text dark:hover:text-white transition"
        >
          <span className="flex items-center gap-2">
            <IconSparkles stroke={iconStroke} size={18} className="text-amber-500" />
            Nectar WhatsApp Gateway Baileys Setup Reference (Developer Guide)
          </span>
          {isGuideOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
        </button>

        {isGuideOpen && (
          <div className="mt-4 p-5 rounded-2xl bg-gray-50 dark:bg-restro-gray/40 border border-restro-border-green text-xs space-y-3">
            <p className="text-gray-600 dark:text-gray-300">
              Your WhatsApp gateway is deployed on Render at{" "}
              <code className="text-emerald-600 dark:text-emerald-400 font-mono">
                https://nectar-58qj.onrender.com
              </code>{" "}
              using the multi-tenant Baileys architecture for session{" "}
              <code className="text-emerald-600 dark:text-emerald-400 font-mono">qwilopro</code>.
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              To enable native Baileys group creation directly on your Nectar repo (
              <a
                href="https://github.com/thecoachmanuel/nectar/tree/main/whatsapp-service"
                target="_blank"
                rel="noreferrer"
                className="text-restro-green hover:underline inline-flex items-center gap-1 font-semibold"
              >
                thecoachmanuel/nectar <IconExternalLink size={12} />
              </a>
              ), add these Express endpoints to{" "}
              <code className="font-mono text-gray-700 dark:text-gray-200">whatsapp-service/index.js</code>:
            </p>
            <pre className="p-4 rounded-xl bg-black text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed">
              {NECTAR_GROUP_CODE}
            </pre>

          </div>
        )}
      </div>
    </Page>
  );
}
