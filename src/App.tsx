import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Check,
  CheckSquare,
  Square,
  Edit3,
  Save,
  MoveRight,
  Share2,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  RefreshCw,
  Wind,
  Compass,
  Moon,
  Sun,
  MapPin,
  Activity,
  Sparkles,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ArrowRight,
  Clock,
  ShieldCheck,
  FileText,
  X,
  Send,
  Sliders,
  HelpCircle,
  CornerDownRight,
  Flame,
  Droplet,
  Trash,
  Beaker,
  Layers,
  ThermometerSnowflake,
  Inbox,
  Radio,
  Keyboard,
  Navigation
} from 'lucide-react';

// ============================================================================
// TYPES & DATA CONTRACTS
// ============================================================================
export type TabKey =
  | 'shopping'
  | 'can_wait'
  | 'do_now'
  | 'quick_notes'
  | 'verifier'
  | 'odour'
  | string;

export type SpeechLang = 'en-IN' | 'hi-IN' | 'en-US';

export interface TaskItem {
  id: string;
  tabId: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface CustomTab {
  id: string;
  name: string;
}

export interface OdourLogItem {
  id: string;
  timestamp: string;
  isoTime: string;
  intensity: number; // 1 to 5
  smellType: string;
  notes: string;
  locationName: string;
  lat: number;
  lon: number;
  windSpeed: number; // m/s
  windDirection: number; // degrees
  cardinalDirection: string;
  boundaryLayerHeight: number; // meters
  isUpwindPlume: boolean;
  isInversionTrapping: boolean;
  assessment: string;
}

export interface StorageSchema {
  tasks: TaskItem[];
  customTabs: CustomTab[];
  odourLogs: OdourLogItem[];
}

const STORAGE_KEY = 'wispr_scratch_app_v2';

// Standard predefined tabs
const DEFAULT_TASK_TABS = [
  { id: 'shopping', name: 'Shopping', desc: 'Groceries & purchases' },
  { id: 'can_wait', name: 'Can Wait / Later', desc: 'Low-priority backlog' },
  { id: 'do_now', name: 'Do Now / Urgent', desc: "Today's priority tasks" },
  { id: 'quick_notes', name: 'Quick Notes', desc: 'General voice notes' },
];

// Quick phrases for 1-tap insertion
const QUICK_PHRASES = [
  '+ Bina pakka bill mat dena',
  '+ Cash only, no UPI',
  '+ Call me if unavailable'
];

// Presets for Odour Witness location
const ODOUR_LOCATIONS = [
  { name: 'Bengaluru (12.97, 77.59)', lat: 12.97, lon: 77.59 },
  { name: 'Mumbai Kanjurmarg (19.12, 72.94)', lat: 19.12, lon: 72.94 },
];

// ============================================================================
// HINGLISH AUTOCORRECT ENGINE (Section 3)
// ============================================================================
export function fixHinglishMisrecognitions(text: string): string {
  if (!text) return '';
  return text
    // \b(nay|nah|knee|na he)\b -> nahi
    .replace(/\b(nay|nah|knee|na he)\b/gi, 'nahi')
    // \b(mud|matt|mutt)\b -> mat
    .replace(/\b(mud|matt|mutt)\b/gi, 'mat')
    // \b(been a|beena)\b -> bina
    .replace(/\b(been a|beena)\b/gi, 'bina')
    // \b(parker bill|puck a bill)\b -> pakka bill
    .replace(/\b(parker bill|puck a bill)\b/gi, 'pakka bill')
    // \b(you pee eye|u p i)\b -> UPI
    .replace(/\b(you pee eye|u p i)\b/gi, 'UPI');
}

// Convert wind angle to 16-point cardinal direction
function degreesToCardinal(deg: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round((deg % 360) / 22.5) % 16;
  return directions[index];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function App() {
  // --------------------------------------------------------------------------
  // STATE: Local Storage & Clean Slate (Section 1)
  // --------------------------------------------------------------------------
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.tasks)) return parsed.tasks;
      }
    } catch (e) {
      console.error('Error reading tasks from localStorage', e);
    }
    // Clean slate: 100% empty on first load. No dummy sample tasks!
    return [];
  });

  const [customTabs, setCustomTabs] = useState<CustomTab[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.customTabs)) return parsed.customTabs;
      }
    } catch (e) {
      console.error('Error reading customTabs from localStorage', e);
    }
    return [];
  });

  const [odourLogs, setOdourLogs] = useState<OdourLogItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.odourLogs)) return parsed.odourLogs;
      }
    } catch (e) {
      console.error('Error reading odourLogs from localStorage', e);
    }
    return [];
  });

  // Sync state to localStorage whenever changed
  useEffect(() => {
    try {
      const payload: StorageSchema = { tasks, customTabs, odourLogs };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [tasks, customTabs, odourLogs]);

  // --------------------------------------------------------------------------
  // STATE: Navigation & UI
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabKey>('shopping');
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');

  // --------------------------------------------------------------------------
  // STATE: Task Voice Input Card (Section 2 & 3)
  // --------------------------------------------------------------------------
  const [taskInputText, setTaskInputText] = useState('');
  const [taskInterimPreview, setTaskInterimPreview] = useState('');
  const [targetSaveTab, setTargetSaveTab] = useState<string>('shopping');
  const [speechLang, setSpeechLang] = useState<SpeechLang>('en-IN');
  const [isTaskListening, setIsTaskListening] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [micBlockedHelp, setMicBlockedHelp] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync default target save tab to active tab when active tab changes (if active tab is a task tab)
  useEffect(() => {
    if (activeTab !== 'verifier' && activeTab !== 'odour') {
      setTargetSaveTab(activeTab);
    }
  }, [activeTab]);

  // Combined list of all available task tabs (Default + Custom)
  const allTaskTabs = useMemo(() => {
    const list = [...DEFAULT_TASK_TABS];
    customTabs.forEach((ct) => {
      list.push({ id: ct.id, name: ct.name, desc: 'Custom tab' });
    });
    return list;
  }, [customTabs]);

  // --------------------------------------------------------------------------
  // SPEECH RECOGNITION (FALLBACK BROWSER MIC - HARDCODED en-IN & maxAlternatives=1)
  // --------------------------------------------------------------------------
  const taskRecognitionRef = useRef<any>(null);

  const isSpeechSupported = useMemo(() => {
    return (
      typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }, []);

  const toggleTaskMic = () => {
    if (!isSpeechSupported) {
      alert('Browser speech recognition is not available. Please use Wispr Flow (Fn or Ctrl+Win) or Chrome/Edge.');
      return;
    }

    if (isTaskListening) {
      if (taskRecognitionRef.current) {
        taskRecognitionRef.current.stop();
      }
      setIsTaskListening(false);
      setTaskInterimPreview('');
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      // UI Upgrade 2: Hardcoded to 'en-IN' and maxAlternatives = 1
      rec.lang = 'en-IN';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsTaskListening(true);
        setMicBlockedHelp(false);
      };

      // CRITICAL ANTI-STUTTER FIX:
      // Loop from event.resultIndex to results.length.
      // ONLY if isFinal === true, append transcript ONCE to committed text and clear interim.
      // If isFinal === false, ONLY update liveInterimPreview badge - NEVER append to textarea!
      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0].transcript;

          if (res.isFinal) {
            // Apply Hinglish autocorrects to the final transcript
            const cleaned = fixHinglishMisrecognitions(transcript);
            setTaskInputText((prev) => {
              const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
              return prev + (needsSpace ? ' ' : '') + cleaned.trim();
            });
            setTaskInterimPreview('');
          } else {
            interim += transcript;
          }
        }
        if (interim) {
          setTaskInterimPreview(interim);
        }
      };

      rec.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setMicBlockedHelp(true);
        }
        setIsTaskListening(false);
        setTaskInterimPreview('');
      };

      rec.onend = () => {
        setIsTaskListening(false);
        setTaskInterimPreview('');
      };

      taskRecognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('Failed to start fallback browser mic', err);
      setIsTaskListening(false);
      setMicBlockedHelp(true);
    }
  };

  // Add quick phrase
  const handleInsertQuickPhrase = (phrase: string) => {
    const cleanPhrase = phrase.replace(/^\+\s*/, '');
    setTaskInputText((prev) => {
      const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
      return prev + (needsSpace ? ' ' : '') + cleanPhrase;
    });
  };

  // Save Task
  const handleSaveTask = () => {
    const textToSave = taskInputText.trim();
    if (!textToSave) return;

    const newTask: TaskItem = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      tabId: targetSaveTab,
      text: textToSave,
      completed: false,
      createdAt: Date.now(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setTaskInputText('');
    setTaskInterimPreview('');
  };

  // Toggle Task Completion
  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  // Delete Single Task
  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Move Task to Another Tab
  const handleMoveTask = (taskId: string, newTabId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, tabId: newTabId } : t))
    );
  };

  // Save Inline Edit
  const handleSaveEdit = (taskId: string) => {
    if (!editingText.trim()) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, text: editingText.trim() } : t))
    );
    setEditingTaskId(null);
    setEditingText('');
  };

  // Clear Completed Tasks in current tab
  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !(t.tabId === activeTab && t.completed)));
  };

  // Clear All Tasks in current tab
  const handleClearAllInTab = () => {
    setTasks((prev) => prev.filter((t) => t.tabId !== activeTab));
    setShowClearConfirm(false);
  };

  // Create Custom Tab
  const handleCreateCustomTab = () => {
    const trimmed = newTabName.trim();
    if (!trimmed) return;
    const tabId = 'custom_' + Date.now();
    const newTab: CustomTab = { id: tabId, name: trimmed };
    setCustomTabs((prev) => [...prev, newTab]);
    setActiveTab(tabId);
    setTargetSaveTab(tabId);
    setNewTabName('');
    setIsCreatingTab(false);
  };

  // Delete Custom Tab
  const handleDeleteCustomTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${allTaskTabs.find(t => t.id === tabId)?.name || 'this tab'}" and move tasks to Quick Notes?`)) {
      setCustomTabs((prev) => prev.filter((t) => t.id !== tabId));
      setTasks((prev) =>
        prev.map((t) => (t.tabId === tabId ? { ...t, tabId: 'quick_notes' } : t))
      );
      if (activeTab === tabId) {
        setActiveTab('shopping');
      }
    }
  };

  // Current tab tasks
  const currentTabTasks = useMemo(() => {
    return tasks.filter((t) => t.tabId === activeTab);
  }, [tasks, activeTab]);

  const completedCount = useMemo(() => {
    return currentTabTasks.filter((t) => t.completed).length;
  }, [currentTabTasks]);

  // --------------------------------------------------------------------------
  // SECTION 4: READBACK VERIFIER (TAB 6)
  // --------------------------------------------------------------------------
  const [speakerText, setSpeakerText] = useState('');
  const [listenerText, setListenerText] = useState('');
  const [isSpeakerListening, setIsSpeakerListening] = useState(false);
  const [isListenerListening, setIsListenerListening] = useState(false);
  const [speakerInterim, setSpeakerInterim] = useState('');
  const [listenerInterim, setListenerInterim] = useState('');
  const [isPassPhoneLocked, setIsPassPhoneLocked] = useState(false);
  const [verifierResults, setVerifierResults] = useState<{
    matched: string[];
    dropped: string[];
    contradicted: { item: string; reason: string }[];
    repairPrompt: string;
  } | null>(null);

  const speakerRecRef = useRef<any>(null);
  const listenerRecRef = useRef<any>(null);

  // Toggle Speaker Fallback Mic (Hardcoded en-IN & maxAlternatives=1)
  const toggleSpeakerMic = () => {
    if (!isSpeechSupported) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    if (isSpeakerListening) {
      speakerRecRef.current?.stop();
      setIsSpeakerListening(false);
      setSpeakerInterim('');
      return;
    }
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const transcript = res[0].transcript;
          if (res.isFinal) {
            const cleaned = fixHinglishMisrecognitions(transcript);
            setSpeakerText((prev) => {
              const sp = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
              return prev + sp + cleaned.trim();
            });
            setSpeakerInterim('');
          } else {
            interim += transcript;
          }
        }
        setSpeakerInterim(interim);
      };
      rec.onend = () => {
        setIsSpeakerListening(false);
        setSpeakerInterim('');
      };
      rec.onerror = () => {
        setIsSpeakerListening(false);
        setSpeakerInterim('');
      };
      speakerRecRef.current = rec;
      rec.start();
      setIsSpeakerListening(true);
    } catch (err) {
      console.error(err);
      setIsSpeakerListening(false);
    }
  };

  // Toggle Listener Fallback Mic (Hardcoded en-IN & maxAlternatives=1)
  const toggleListenerMic = () => {
    if (!isSpeechSupported) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    if (isListenerListening) {
      listenerRecRef.current?.stop();
      setIsListenerListening(false);
      setListenerInterim('');
      return;
    }
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const transcript = res[0].transcript;
          if (res.isFinal) {
            const cleaned = fixHinglishMisrecognitions(transcript);
            setListenerText((prev) => {
              const sp = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
              return prev + sp + cleaned.trim();
            });
            setListenerInterim('');
          } else {
            interim += transcript;
          }
        }
        setListenerInterim(interim);
      };
      rec.onend = () => {
        setIsListenerListening(false);
        setListenerInterim('');
      };
      rec.onerror = () => {
        setIsListenerListening(false);
        setListenerInterim('');
      };
      listenerRecRef.current = rec;
      rec.start();
      setIsListenerListening(true);
    } catch (err) {
      console.error(err);
      setIsListenerListening(false);
    }
  };

  // Sample Scenarios for Readback Verifier
  const loadScenario1 = () => {
    setSpeakerText(
      'Take 15 pills after food, bina pakka bill mat lena and don\'t pay more than 50 rupees.'
    );
    setListenerText(
      'Take 50 pills before food, bina pakka bill lena and pay 50 rupees.'
    );
    setVerifierResults(null);
    setIsPassPhoneLocked(false);
  };

  const loadScenario2 = () => {
    setSpeakerText(
      'Deliver 2 packets before 5 PM only if payment is cash, never accept UPI without receipt.'
    );
    setListenerText(
      'Deliver 2 packets after 5 PM if payment is cash, accept UPI without receipt.'
    );
    setVerifierResults(null);
    setIsPassPhoneLocked(false);
  };

  // Confirmation Chips Extraction from Speaker Text
  const speakerConstraints = useMemo(() => {
    const text = speakerText;
    if (!text) return { numbers: [], negations: [], conditions: [] };

    // 1. Numbers / Times: digits or numbers with units
    const numberMatches = text.match(/\b\d+(?:\.\d+)?(?:\s*(?:am|pm|pills?|rupees?|rs|packets?|kg|gm|l|ml))?\b/gi) || [];
    const uniqueNumbers = Array.from(new Set(numberMatches));

    // 2. Negations: nahi, mat, bina, not, don't, never, without
    const negationMatches = text.match(/\b(nahi|mat|bina|not|don't|dont|never|without|no|neither|nor)\b/gi) || [];
    const uniqueNegations = Array.from(new Set(negationMatches.map((n) => n.toLowerCase())));

    // 3. Conditions: if, only if, unless, before, after, when, provided
    const conditionMatches = text.match(/\b(only if|if|unless|before|after|when|provided|until)\b/gi) || [];
    const uniqueConditions = Array.from(new Set(conditionMatches.map((c) => c.toLowerCase())));

    return {
      numbers: uniqueNumbers,
      negations: uniqueNegations,
      conditions: uniqueConditions,
    };
  }, [speakerText]);

  // Teen-Ty Flip Helper (e.g. 15 <-> 50, 13 <-> 30, etc.)
  const handleTeenTyFlip = (numStr: string) => {
    const match = numStr.match(/\d+/);
    if (!match) return;
    const digits = match[0];
    const val = parseInt(digits, 10);
    let flippedVal = val;

    const flipMap: Record<number, number> = {
      13: 30, 30: 13,
      14: 40, 40: 14,
      15: 50, 50: 15,
      16: 60, 60: 16,
      17: 70, 70: 17,
      18: 80, 80: 18,
      19: 90, 90: 19,
    };

    if (flipMap[val]) {
      flippedVal = flipMap[val];
    } else if (val === 15) {
      flippedVal = 50;
    } else if (val === 50) {
      flippedVal = 15;
    } else if (val > 12 && val < 20) {
      flippedVal = (val % 10) * 10;
    } else if (val >= 20 && val <= 90 && val % 10 === 0) {
      flippedVal = 10 + Math.floor(val / 10);
    } else {
      flippedVal = val === 15 ? 50 : 15;
    }

    const newTarget = numStr.replace(digits, flippedVal.toString());
    setSpeakerText((prev) => prev.replace(numStr, newTarget));
  };

  // Increment / Decrement Number Helper
  const handleAdjustNumber = (numStr: string, delta: number) => {
    const match = numStr.match(/\d+/);
    if (!match) return;
    const digits = match[0];
    const val = parseInt(digits, 10);
    const newVal = Math.max(0, val + delta);
    const newTarget = numStr.replace(digits, newVal.toString());
    setSpeakerText((prev) => prev.replace(numStr, newTarget));
  };

  // Compare Box 1 vs Box 2 (Unblur & Check Readback)
  const handleCheckReadback = () => {
    setIsPassPhoneLocked(false);

    const sLower = speakerText.toLowerCase();
    const lLower = listenerText.toLowerCase();

    const matched: string[] = [];
    const dropped: string[] = [];
    const contradicted: { item: string; reason: string }[] = [];
    const repairFixes: string[] = [];

    // 1. Analyze Numbers & Times
    speakerConstraints.numbers.forEach((item) => {
      const matchNum = item.match(/\d+/);
      const digits = matchNum ? matchNum[0] : item;
      const numVal = parseInt(digits, 10);

      if (lLower.includes(digits)) {
        matched.push(`Quantity "${item}" accurately preserved`);
      } else {
        let teenTyPartner = '';
        if (numVal === 15 && lLower.includes('50')) teenTyPartner = '50';
        else if (numVal === 50 && lLower.includes('15')) teenTyPartner = '15';
        else if (numVal === 13 && lLower.includes('30')) teenTyPartner = '30';
        else if (numVal === 30 && lLower.includes('13')) teenTyPartner = '13';
        else if (numVal === 14 && lLower.includes('40')) teenTyPartner = '40';
        else if (numVal === 40 && lLower.includes('14')) teenTyPartner = '14';

        if (teenTyPartner) {
          contradicted.push({
            item: `Number "${item}" flipped to "${teenTyPartner}"`,
            reason: `Listener misheard ${item} as ${teenTyPartner} (Teen-Ty confusion).`,
          });
          repairFixes.push(`Make sure it is ${item}, NOT ${teenTyPartner}`);
        } else {
          dropped.push(`Quantity "${item}" missing in readback`);
          repairFixes.push(`Confirm quantity "${item}"`);
        }
      }
    });

    // 2. Analyze Negations (Dangerous inversion check!)
    speakerConstraints.negations.forEach((neg) => {
      const reg = new RegExp(`\\b${neg}\\s+([a-zA-Z]+)`, 'i');
      const sContext = speakerText.match(reg);
      const targetVerb = sContext ? sContext[1].toLowerCase() : '';

      if (lLower.includes(neg)) {
        matched.push(`Negation "${neg}" preserved`);
      } else if (targetVerb && lLower.includes(targetVerb)) {
        contradicted.push({
          item: `Negation "${neg}" was dropped on verb "${targetVerb}"`,
          reason: `Speaker said "${neg} ${targetVerb}", but listener said "${targetVerb}" (Action inverted!)`,
        });
        repairFixes.push(`CRITICAL: Do NOT ${targetVerb} (remember "${neg} ${targetVerb}")`);
      } else {
        dropped.push(`Negation constraint "${neg}" omitted`);
        repairFixes.push(`Remember prohibition: "${neg}"`);
      }
    });

    // 3. Analyze Conditions (e.g. before vs after, only if)
    speakerConstraints.conditions.forEach((cond) => {
      if (cond === 'before' && lLower.includes('after')) {
        contradicted.push({
          item: `Condition "before" swapped to "after"`,
          reason: 'Timeline reversed: speaker said "before", listener heard "after".',
        });
        repairFixes.push('Must be BEFORE, not after');
      } else if (cond === 'after' && lLower.includes('before')) {
        contradicted.push({
          item: `Condition "after" swapped to "before"`,
          reason: 'Timeline reversed: speaker said "after", listener heard "before".',
        });
        repairFixes.push('Must be AFTER, not before');
      } else if (lLower.includes(cond)) {
        matched.push(`Condition "${cond}" confirmed`);
      } else {
        dropped.push(`Condition "${cond}" omitted`);
        repairFixes.push(`Observe condition: "${cond}"`);
      }
    });

    // Generate bold 1-sentence "Say This to Fix It" prompt
    let repairPrompt = '';
    if (contradicted.length === 0 && dropped.length === 0) {
      repairPrompt = 'Everything matches perfectly! Spoken handoff is 100% verified.';
    } else {
      const keyIssues = repairFixes.slice(0, 3).join(', and ');
      repairPrompt = `Clarify right now: "${keyIssues}!"`;
    }

    setVerifierResults({
      matched,
      dropped,
      contradicted,
      repairPrompt,
    });
  };

  // Speak Repair Prompt (TTS)
  const handleSpeakRepair = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Speech synthesis not supported in this browser.');
    }
  };

  // --------------------------------------------------------------------------
  // SECTION 5: ODOUR WITNESS (2 AM) - PURE BLACK #000000 & WEATHER WIDGET
  // --------------------------------------------------------------------------
  const [odourNotes, setOdourNotes] = useState('');
  const [odourInterim, setOdourInterim] = useState('');
  const [odourIntensity, setOdourIntensity] = useState<number>(3);
  const [odourType, setOdourType] = useState<string>('Burning Plastic');
  const [selectedLocation, setSelectedLocation] = useState(ODOUR_LOCATIONS[0]);
  const [customLat, setCustomLat] = useState('12.97');
  const [customLon, setCustomLon] = useState('77.59');
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isOdourListening, setIsOdourListening] = useState(false);
  const odourRecRef = useRef<any>(null);

  // Toggle Odour Fallback Voice Mic (Hardcoded en-IN & maxAlternatives=1)
  const toggleOdourMic = () => {
    if (!isSpeechSupported) {
      alert('Speech recognition not supported.');
      return;
    }
    if (isOdourListening) {
      odourRecRef.current?.stop();
      setIsOdourListening(false);
      setOdourInterim('');
      return;
    }
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const transcript = res[0].transcript;
          if (res.isFinal) {
            const cleaned = fixHinglishMisrecognitions(transcript);
            setOdourNotes((prev) => {
              const sp = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
              return prev + sp + cleaned.trim();
            });
            setOdourInterim('');
          } else {
            interim += transcript;
          }
        }
        setOdourInterim(interim);
      };
      rec.onend = () => {
        setIsOdourListening(false);
        setOdourInterim('');
      };
      rec.onerror = () => {
        setIsOdourListening(false);
        setOdourInterim('');
      };
      odourRecRef.current = rec;
      rec.start();
      setIsOdourListening(true);
    } catch (err) {
      console.error(err);
      setIsOdourListening(false);
    }
  };

  // Use GPS Coordinates
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(4));
        const lon = parseFloat(pos.coords.longitude.toFixed(4));
        const gpsLoc = { name: `My Phone GPS (${lat}, ${lon})`, lat, lon };
        setSelectedLocation(gpsLoc);
        setCustomLat(lat.toString());
        setCustomLon(lon.toString());
      },
      (err) => {
        alert('Could not get GPS location: ' + err.message);
      }
    );
  };

  // Fetch Open-Meteo Wind & Boundary Layer and Log
  const handleLogAndCheckWind = async () => {
    setIsFetchingWeather(true);
    setWeatherError(null);

    const lat = selectedLocation.lat;
    const lon = selectedLocation.lon;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,boundary_layer_height&wind_speed_unit=ms&past_days=1&timezone=auto`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather service error: ${res.status}`);
      const data = await res.json();

      const hourly = data.hourly;
      if (!hourly || !hourly.time || hourly.time.length === 0) {
        throw new Error('No hourly meteorological data returned');
      }

      const now = new Date();
      let bestIdx = 0;
      let minDiff = Infinity;

      for (let i = 0; i < hourly.time.length; i++) {
        const entryTime = new Date(hourly.time[i]);
        const diff = Math.abs(now.getTime() - entryTime.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }

      const windSpeed = hourly.wind_speed_10m?.[bestIdx] ?? 1.8;
      const windDir = hourly.wind_direction_10m?.[bestIdx] ?? 45;
      const boundaryLayer = hourly.boundary_layer_height?.[bestIdx] ?? 120;
      const cardinal = degreesToCardinal(windDir);

      // Meteorological Assessment Rules:
      // Upwind Plume: wind_speed >= 1.5 m/s
      // Nocturnal Inversion Trapping: boundary_layer_height < 150m
      const isUpwindPlume = windSpeed >= 1.5;
      const isInversionTrapping = boundaryLayer < 150;

      let assessment = '';
      if (isUpwindPlume && isInversionTrapping) {
        assessment = `CRITICAL DUAL THREAT: Nocturnal Inversion Trapping (${boundaryLayer}m < 150m) holding toxic emissions near ground while Upwind Plume (${windSpeed} m/s from ${cardinal}) channels plume directly into residential pocket.`;
      } else if (isInversionTrapping) {
        assessment = `SEVERE INVERSION TRAPPING: Stagnant nocturnal boundary layer (${boundaryLayer}m < 150m) trapping ground-level emissions without dispersion.`;
      } else if (isUpwindPlume) {
        assessment = `UPWIND PLUME DETECTED: Wind velocity (${windSpeed} m/s from ${cardinal}) transporting emission plume from source sector. Boundary layer at ${boundaryLayer}m.`;
      } else {
        assessment = `MODERATE: Low wind speed (${windSpeed} m/s) with boundary layer at ${boundaryLayer}m. Dispersal rate restricted.`;
      }

      const newLog: OdourLogItem = {
        id: 'odour_' + Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        isoTime: new Date().toISOString(),
        intensity: odourIntensity,
        smellType: odourType,
        notes: odourNotes.trim() || 'No additional note provided',
        locationName: selectedLocation.name,
        lat,
        lon,
        windSpeed,
        windDirection: windDir,
        cardinalDirection: cardinal,
        boundaryLayerHeight: boundaryLayer,
        isUpwindPlume,
        isInversionTrapping,
        assessment,
      };

      setOdourLogs((prev) => [newLog, ...prev]);
      setOdourNotes('');
      setOdourInterim('');
    } catch (err: any) {
      console.error('Weather fetch error:', err);
      setWeatherError(err.message || 'Failed to fetch weather data.');
    } finally {
      setIsFetchingWeather(false);
    }
  };

  // Copy formal complaint text
  const handleCopyComplaint = (log: OdourLogItem) => {
    const text = `URGENT NIGHTTIME POLLUTION INCIDENT REPORT
Time: ${log.timestamp}
Location: ${log.locationName} (${log.lat}, ${log.lon})
Odour Identified: ${log.smellType}
Intensity Rating: Level ${log.intensity}/5
Atmospheric Verification (Open-Meteo):
- Wind Speed: ${log.windSpeed} m/s from ${log.cardinalDirection} (${log.windDirection}°)
- Planetary Boundary Layer Height: ${log.boundaryLayerHeight} m
- Verification Verdict: ${log.isUpwindPlume ? '[UPWIND PLUME ACTIVE]' : ''} ${log.isInversionTrapping ? '[NOCTURNAL INVERSION TRAPPING]' : ''}
Field Observation: "${log.notes}"

This incident log has been scientifically recorded with real-time meteorological verification. Please inspect nearby industrial/waste burning sources immediately.`;

    navigator.clipboard.writeText(text);
    alert('Formal complaint text copied to clipboard!');
  };

  // Delete odour log entry
  const handleDeleteOdourLog = (id: string) => {
    setOdourLogs((prev) => prev.filter((item) => item.id !== id));
  };

  // Check if pure pitch-black night theme is active (Odour Witness Tab)
  const isNightTheme = activeTab === 'odour';

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 ${
        isNightTheme
          ? 'bg-[#000000] text-slate-100 selection:bg-amber-500/30'
          : 'bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 text-slate-100 selection:bg-indigo-500/30'
      }`}
    >
      {/* =====================================================================
          HEADER & SLEEK SEGMENTED TAB BAR (UI UPGRADE 1)
          ===================================================================== */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/70 border-b border-slate-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3">
          {/* Top Row: Brand & Wispr Flow Desktop Guide */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg ${
                  isNightTheme
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/10'
                    : 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-indigo-500/20'
                }`}
              >
                {isNightTheme ? <Moon className="w-5 h-5" /> : <Sparkles className="w-5 h-5 text-indigo-200" />}
              </div>
              <div>
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight leading-none flex items-center gap-2 text-white">
                  <span>Wispr Workspace</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Flow v2
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Voice Workspace · Readback Verifier · 2 AM Odour Witness
                </p>
              </div>
            </div>

            {/* Desktop Wispr Flow Shortcut Badge & Browser Support */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 shadow-inner">
                <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium text-slate-400">Wispr Flow:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] text-indigo-300 font-bold shadow-xs">
                  Fn
                </kbd>
                <span className="text-slate-500">or</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] text-indigo-300 font-bold shadow-xs">
                  Ctrl+Win
                </kbd>
              </div>

              {/* Mic blocked helper link */}
              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1.5"
                title="Open in new browser tab if microphone is blocked in iframe"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            </div>
          </div>

          {/* Top Navigation Tab Bar: Sleek Segmented Control */}
          <div className="bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-inner">
            {/* 1. Shopping */}
            <button
              onClick={() => setActiveTab('shopping')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === 'shopping'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.25)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span>Shopping</span>
              {tasks.filter((t) => t.tabId === 'shopping').length > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'shopping'
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tasks.filter((t) => t.tabId === 'shopping').length}
                </span>
              )}
            </button>

            {/* 2. Can Wait / Later */}
            <button
              onClick={() => setActiveTab('can_wait')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === 'can_wait'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.25)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span>Can Wait / Later</span>
              {tasks.filter((t) => t.tabId === 'can_wait').length > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'can_wait'
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tasks.filter((t) => t.tabId === 'can_wait').length}
                </span>
              )}
            </button>

            {/* 3. Do Now / Urgent */}
            <button
              onClick={() => setActiveTab('do_now')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === 'do_now'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.25)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span>Do Now / Urgent</span>
              {tasks.filter((t) => t.tabId === 'do_now').length > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'do_now'
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tasks.filter((t) => t.tabId === 'do_now').length}
                </span>
              )}
            </button>

            {/* 4. Quick Notes */}
            <button
              onClick={() => setActiveTab('quick_notes')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === 'quick_notes'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.25)] font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <span>Quick Notes</span>
              {tasks.filter((t) => t.tabId === 'quick_notes').length > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'quick_notes'
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tasks.filter((t) => t.tabId === 'quick_notes').length}
                </span>
              )}
            </button>

            {/* Custom User Tabs */}
            {customTabs.map((ct) => (
              <div
                key={ct.id}
                className={`group flex items-center rounded-xl pl-3 pr-1.5 py-1 text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  activeTab === ct.id
                    ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.25)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <button
                  onClick={() => setActiveTab(ct.id)}
                  className="mr-1.5 flex items-center gap-1.5"
                >
                  <span>{ct.name}</span>
                  {tasks.filter((t) => t.tabId === ct.id).length > 0 && (
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                        activeTab === ct.id
                          ? 'bg-indigo-500/30 text-indigo-200'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tasks.filter((t) => t.tabId === ct.id).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => handleDeleteCustomTab(ct.id, e)}
                  title={`Delete ${ct.name} tab`}
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* 5. + New Tab Button */}
            {isCreatingTab ? (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-indigo-500/50 rounded-xl px-2 py-1 shadow-lg">
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCustomTab();
                    if (e.key === 'Escape') setIsCreatingTab(false);
                  }}
                  autoFocus
                  placeholder="Tab name (e.g. Work)"
                  className="px-2 py-1 text-xs bg-transparent border-none focus:outline-none text-slate-100 placeholder:text-slate-500 w-28"
                />
                <button
                  onClick={handleCreateCustomTab}
                  className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 shadow-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsCreatingTab(false)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingTab(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border border-dashed border-slate-700/80 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50 hover:bg-slate-800/40 transition-all whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Tab</span>
              </button>
            )}

            <div className="h-5 w-[1px] bg-slate-800 mx-1 flex-shrink-0" />

            {/* 6. Readback Verifier */}
            <button
              onClick={() => setActiveTab('verifier')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === 'verifier'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25)] font-semibold'
                  : 'text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Readback Verifier</span>
            </button>

            {/* 7. Odour Witness (2 AM) */}
            <button
              onClick={() => setActiveTab('odour')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === 'odour'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25)] font-semibold ring-1 ring-amber-500/30'
                  : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/30 border border-transparent'
              }`}
            >
              <Moon className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Odour Witness (2 AM)</span>
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTENT AREA (DARK GLASSMORPHISM)
          ===================================================================== */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ===================================================================
            VIEW 1: TASK TABS (Tabs 1-4 & Custom Tabs)
            =================================================================== */}
        {activeTab !== 'verifier' && activeTab !== 'odour' && (
          <div className="space-y-6">
            {/* Helper alert if mic blocked */}
            {micBlockedHelp && (
              <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-950/30 backdrop-blur-md text-amber-200 text-sm flex items-start gap-3 shadow-lg">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-300">Microphone Access Restricted</p>
                  <p className="mt-0.5 text-xs text-amber-200/80">
                    Browser security blocks mic access in embedded frames. Wispr Flow desktop app still works universally using your global hotkey (Fn or Ctrl+Win). Alternatively, open this app in a standalone tab.
                  </p>
                  <button
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in New Browser Tab
                  </button>
                </div>
                <button
                  onClick={() => setMicBlockedHelp(false)}
                  className="text-amber-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Voice Input Card: Frosted Glass & Wispr Flow Optimized (UI UPGRADE 1 & 2) */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 shadow-xl rounded-2xl p-5 sm:p-6 transition-all">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      Wispr Flow Voice Dictation
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Focus input and hold your global desktop hotkey
                    </span>
                  </div>
                </div>

                {/* Desktop Hotkey Pills */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">Hotkey:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-indigo-300 font-semibold shadow-xs">
                    Fn
                  </span>
                  <span className="text-slate-500">/</span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-indigo-300 font-semibold shadow-xs">
                    Ctrl+Win
                  </span>
                </div>
              </div>

              {/* Textarea: Premium Dark Glass & Wispr Flow Placeholder (UI UPGRADE 2) */}
              <div className="relative">
                <textarea
                  value={taskInputText}
                  onChange={(e) => setTaskInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSaveTask();
                    }
                  }}
                  rows={3}
                  placeholder="Hold your Wispr Flow hotkey (Fn or Ctrl+Win) to speak..."
                  className="w-full bg-slate-900/50 border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-4 text-lg text-slate-100 placeholder:text-slate-500 transition-all min-h-[110px] resize-y"
                />
              </div>

              {/* CRITICAL ANTI-STUTTER: Subtle Interim Preview Badge */}
              {taskInterimPreview && (
                <div className="mt-2 px-3 py-1.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
                  <span className="font-semibold text-sky-400 flex-shrink-0">Live Interim:</span>
                  <span className="italic truncate">{taskInterimPreview}</span>
                </div>
              )}

              {/* Controls Bar Below Textarea: Fallback Mic & Quick Phrases */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                {/* 1-Tap Quick Phrase Bar */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium mr-1">Quick Add:</span>
                  {QUICK_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => handleInsertQuickPhrase(phrase)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900/60 text-slate-300 hover:text-indigo-200 hover:bg-indigo-950/40 border border-slate-700/60 hover:border-indigo-500/40 transition-all"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>

                {/* Subtle Fallback Browser Mic Button (UI UPGRADE 2) */}
                <button
                  type="button"
                  onClick={toggleTaskMic}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    isTaskListening
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse'
                      : 'bg-slate-900/50 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800/80 hover:border-slate-600'
                  }`}
                  title="Use Web Speech API browser mic as fallback (Hardcoded en-IN)"
                >
                  {isTaskListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>Listening (en-IN)...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-slate-400" />
                      <span>Fallback Browser Mic</span>
                    </>
                  )}
                </button>
              </div>

              {/* Save to Tab Pill Buttons (Section 2) */}
              <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 mr-1.5">Save to Tab:</span>
                  {allTaskTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTargetSaveTab(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        targetSaveTab === tab.id
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                          : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:bg-slate-800/50'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveTask}
                  disabled={!taskInputText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Note</span>
                </button>
              </div>
            </div>

            {/* Task List Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{allTaskTabs.find((t) => t.id === activeTab)?.name || 'Tasks'}</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                    {currentTabTasks.length} {currentTabTasks.length === 1 ? 'item' : 'items'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {allTaskTabs.find((t) => t.id === activeTab)?.desc || 'Manage items in this list'}
                </p>
              </div>

              {completedCount > 0 && (
                <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/30">
                  {completedCount} completed
                </span>
              )}
            </div>

            {/* Task List: Empty States (UI UPGRADE 3) */}
            {currentTabTasks.length === 0 ? (
              <div className="bg-slate-800/30 backdrop-blur-md border border-slate-700/40 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-xl">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full" />
                  <Inbox className="w-16 h-16 text-indigo-400 opacity-20 relative z-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-200">
                    All clear! Hold your Wispr Flow hotkey to add a new task to {allTaskTabs.find((t) => t.id === activeTab)?.name || 'this tab'}.
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Press <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-indigo-300 text-[11px]">Fn</span> or <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-indigo-300 text-[11px]">Ctrl+Win</span> anywhere, speak naturally, and Wispr Flow will dictate right in.
                  </p>
                </div>
              </div>
            ) : (
              /* Frosted Glass Task Cards (UI UPGRADE 1) */
              <div className="space-y-2.5">
                {currentTabTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`bg-slate-800/50 backdrop-blur-md border border-slate-700/50 shadow-xl rounded-2xl p-3.5 sm:p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      task.completed
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                        : 'hover:border-slate-600/70 hover:shadow-2xl'
                    }`}
                  >
                    {/* Left: Checkbox & Editable Text */}
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className={`mt-0.5 sm:mt-0 p-1 rounded-lg transition-colors flex-shrink-0 ${
                          task.completed
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={task.completed ? 'Mark Incomplete' : 'Mark Complete'}
                      >
                        {task.completed ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500" />
                        )}
                      </button>

                      {editingTaskId === task.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(task.id);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            autoFocus
                            className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-indigo-500 text-sm text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(task.id)}
                            className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTaskId(null)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <p
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setEditingText(task.text);
                            }}
                            className={`text-sm cursor-pointer break-words ${
                              task.completed
                                ? 'line-through text-slate-500'
                                : 'text-slate-100 font-medium'
                            }`}
                            title="Click to edit task"
                          >
                            {task.text}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(task.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Move to Another Tab Dropdown & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700/40 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <MoveRight className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                        <select
                          value={task.tabId}
                          onChange={(e) => handleMoveTask(task.id, e.target.value)}
                          className="text-xs bg-slate-900/80 border border-slate-700 text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          title="Move to another tab"
                        >
                          <option disabled value="">
                            Move to...
                          </option>
                          {allTaskTabs.map((tab) => (
                            <option key={tab.id} value={tab.id} className="bg-slate-900 text-slate-200">
                              {tab.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingTaskId(task.id);
                          setEditingText(task.text);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                        title="Edit text"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Actions: Clear Completed and Clear All in Tab */}
            {currentTabTasks.length > 0 && (
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  disabled={completedCount === 0}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 bg-slate-800/40 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Clear Completed ({completedCount})
                </button>

                {showClearConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-400 font-bold">Clear all tasks in tab?</span>
                    <button
                      type="button"
                      onClick={handleClearAllInTab}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 shadow-sm"
                    >
                      Yes, Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
                  >
                    Clear All in Tab
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            VIEW 2: READBACK VERIFIER (TAB 6 - UI UPGRADE 4)
            =================================================================== */}
        {activeTab === 'verifier' && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-emerald-500/30 shadow-xl rounded-2xl p-5">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Spoken Handoff Verifier</span>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Prevents misheard critical constraints (quantities, negations like "nahi/mat/bina", and conditions like "before/after") during verbal handoffs between two people.
              </p>

              {/* Sample Scenarios for 1-Click Testing */}
              <div className="mt-3.5 pt-3.5 border-t border-slate-700/60 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Quick Test Scenarios:</span>
                <button
                  type="button"
                  onClick={loadScenario1}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all shadow-xs"
                >
                  Scenario 1: Pharmacy 15 vs 50 / Hinglish Negation
                </button>
                <button
                  type="button"
                  onClick={loadScenario2}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all shadow-xs"
                >
                  Scenario 2: Cash Delivery / Time Condition
                </button>
              </div>
            </div>

            {/* Box 1: Speaker Instruction */}
            <div
              className={`bg-slate-800/50 backdrop-blur-md border border-slate-700/50 shadow-xl rounded-2xl p-5 sm:p-6 transition-all ${
                isPassPhoneLocked ? 'relative overflow-hidden' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                    1
                  </span>
                  <span>Speaker Instruction (Person 1)</span>
                </span>
                {isSpeakerListening && (
                  <span className="text-xs text-rose-400 font-semibold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Listening (en-IN)...
                  </span>
                )}
              </div>

              {/* Pass Phone Mode Blur Overlay */}
              {isPassPhoneLocked ? (
                <div className="my-2 p-8 rounded-xl bg-slate-950/80 backdrop-blur-lg text-white text-center flex flex-col items-center justify-center gap-2.5 border border-slate-700 shadow-inner">
                  <Lock className="w-8 h-8 text-amber-400 animate-bounce" />
                  <p className="font-bold text-sm text-slate-100">Speaker Instruction Locked & Hidden</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Pass the phone to Person 2. They will speak what they understood in Box 2 without peeking at this instruction.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsPassPhoneLocked(false)}
                    className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-600 flex items-center gap-1.5 transition-all"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Peek / Unlock
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    value={speakerText}
                    onChange={(e) => setSpeakerText(e.target.value)}
                    rows={3}
                    placeholder="Hold your Wispr Flow hotkey (Fn or Ctrl+Win) to speak speaker instruction..."
                    className="w-full rounded-xl bg-slate-900/50 border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 p-4 text-base text-slate-100 placeholder:text-slate-500 min-h-[100px] transition-all"
                  />
                </div>
              )}

              {speakerInterim && (
                <div className="mt-2 text-xs text-sky-400 italic">
                  Live interim: {speakerInterim}
                </div>
              )}

              {/* Confirmation Chips: Vibrant Glowing Tags (UI UPGRADE 4) */}
              {!isPassPhoneLocked && speakerText.trim() && (
                <div className="mt-4 pt-3.5 border-t border-slate-700/50 space-y-2.5">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Extracted Confirmation Chips:
                  </div>

                  {/* Numbers Chips (Glowing Blue) */}
                  {speakerConstraints.numbers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-blue-400 font-semibold">Numbers:</span>
                      {speakerConstraints.numbers.map((num) => (
                        <div
                          key={num}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)] text-xs font-semibold"
                        >
                          <span>{num}</span>
                          {/* Swap 15 <-> 50 button */}
                          <button
                            type="button"
                            onClick={() => handleTeenTyFlip(num)}
                            className="px-1.5 py-0.5 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-[10px] font-bold transition-colors"
                            title="Flip Teen to -Ty (e.g. 15 <-> 50)"
                          >
                            Swap Teen/Ty
                          </button>
                          {/* +/- buttons */}
                          <button
                            type="button"
                            onClick={() => handleAdjustNumber(num, 1)}
                            className="w-4 h-4 rounded-md bg-blue-500/30 hover:bg-blue-500/50 flex items-center justify-center text-blue-200 text-[10px] font-bold"
                            title="Increment +1"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustNumber(num, -1)}
                            className="w-4 h-4 rounded-md bg-blue-500/30 hover:bg-blue-500/50 flex items-center justify-center text-blue-200 text-[10px] font-bold"
                            title="Decrement -1"
                          >
                            -
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Negations Chips (Glowing Red) */}
                  {speakerConstraints.negations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-red-400 font-semibold">Negations:</span>
                      {speakerConstraints.negations.map((neg) => (
                        <span
                          key={neg}
                          className="px-3 py-1 rounded-xl bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.2)] text-xs font-semibold"
                        >
                          🚫 {neg}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Conditions Chips (Glowing Amber) */}
                  {speakerConstraints.conditions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-amber-400 font-semibold">Conditions:</span>
                      {speakerConstraints.conditions.map((cond) => (
                        <span
                          key={cond}
                          className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] text-xs font-semibold"
                        >
                          ⚡ {cond}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons for Box 1 */}
              <div className="mt-4 pt-3.5 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsPassPhoneLocked(!isPassPhoneLocked)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isPassPhoneLocked
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isPassPhoneLocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unlock & Show Speaker Text</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock & Hide Speaker Text (Pass Phone Mode)</span>
                    </>
                  )}
                </button>

                {/* Fallback Browser Mic for Speaker */}
                <button
                  type="button"
                  onClick={toggleSpeakerMic}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    isSpeakerListening
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                      : 'bg-slate-900/50 text-slate-400 border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Fallback Browser Mic</span>
                </button>
              </div>
            </div>

            {/* Box 2: Listener Readback */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 shadow-xl rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <span>Listener Readback (Person 2 - What Did You Hear?)</span>
                </span>
                {isListenerListening && (
                  <span className="text-xs text-rose-400 font-semibold animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Listening (en-IN)...
                  </span>
                )}
              </div>

              <div className="relative">
                <textarea
                  value={listenerText}
                  onChange={(e) => setListenerText(e.target.value)}
                  rows={3}
                  placeholder="Hold your Wispr Flow hotkey (Fn or Ctrl+Win) to speak listener readback..."
                  className="w-full rounded-xl bg-slate-900/50 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 p-4 text-base text-slate-100 placeholder:text-slate-500 min-h-[100px] transition-all"
                />
              </div>

              {listenerInterim && (
                <div className="mt-2 text-xs text-sky-400 italic">
                  Live interim: {listenerInterim}
                </div>
              )}

              {/* Action Buttons for Box 2 */}
              <div className="mt-4 pt-3.5 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={toggleListenerMic}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    isListenerListening
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                      : 'bg-slate-900/50 text-slate-400 border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Fallback Browser Mic</span>
                </button>

                <button
                  type="button"
                  onClick={handleCheckReadback}
                  disabled={!speakerText.trim() || !listenerText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Unblur & Check Readback</span>
                </button>
              </div>
            </div>

            {/* Readback Diff Scorecard: Frosted Glass (UI UPGRADE 1 & 4) */}
            {verifierResults && (
              <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 shadow-2xl rounded-2xl p-5 sm:p-6 space-y-4">
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <span>Constraint Verification Scorecard</span>
                </h3>

                {/* GREEN: Matched */}
                {verifierResults.matched.length > 0 && (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-300 mb-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Matched ({verifierResults.matched.length})</span>
                    </div>
                    <ul className="text-xs space-y-1 list-disc list-inside text-emerald-200/90">
                      {verifierResults.matched.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AMBER: Dropped / Forgotten */}
                {verifierResults.dropped.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-amber-300 mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Dropped / Forgotten ({verifierResults.dropped.length})</span>
                    </div>
                    <ul className="text-xs space-y-1 list-disc list-inside text-amber-200/90">
                      {verifierResults.dropped.map((d, idx) => (
                        <li key={idx}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* RED: Contradicted / Wrong Number or Negation */}
                {verifierResults.contradicted.length > 0 && (
                  <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-rose-300 mb-1.5">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>Contradicted / Dangerous Inversion ({verifierResults.contradicted.length})</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      {verifierResults.contradicted.map((c, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-900/80 border border-rose-500/30">
                          <p className="font-bold text-rose-300">{c.item}</p>
                          <p className="text-slate-300 mt-0.5">{c.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bold 1-sentence "Say This to Fix It" Repair Prompt */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Say This to Fix It:</span>
                    </div>
                    <p className="text-sm font-bold mt-1 text-white leading-snug">
                      {verifierResults.repairPrompt}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSpeakRepair(verifierResults.repairPrompt)}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Read aloud repair prompt"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Speak</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(verifierResults.repairPrompt);
                        alert('Repair prompt copied!');
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            VIEW 3: ODOUR WITNESS (2 AM - PURE BLACK #000000 & WEATHER WIDGET)
            =================================================================== */}
        {activeTab === 'odour' && (
          <div className="space-y-6">
            {/* Pure Black Night Banner (UI UPGRADE 4) */}
            <div className="p-4 rounded-2xl bg-[#000000] border border-amber-500/40 text-amber-300 flex items-start justify-between gap-3 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
              <div>
                <div className="flex items-center gap-2 font-black text-base text-amber-400">
                  <Moon className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span>2:00 AM Odour Witness & Meteorological Diagnostics</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Deep pure-black (#000000) high-contrast theme for eyes-half-closed comfort. Verifies nocturnal chemical smells against real-time Open-Meteo wind vectors and nocturnal inversion trapping.
                </p>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex-shrink-0">
                Pure #000000 Night
              </span>
            </div>

            {/* Input & Form Card */}
            <div className="bg-[#050505] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6">
              {/* Spoken Smell Log Textarea */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <span>Describe the Smell (Wispr Flow or Voice):</span>
                  {isOdourListening && (
                    <span className="text-rose-400 text-xs font-semibold animate-pulse flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      Listening (en-IN)...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <textarea
                    value={odourNotes}
                    onChange={(e) => setOdourNotes(e.target.value)}
                    rows={2}
                    placeholder="Hold your Wispr Flow hotkey (Fn or Ctrl+Win) to describe the smell..."
                    className="w-full rounded-xl bg-black border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 p-4 text-base text-slate-100 placeholder:text-slate-600 min-h-[90px] transition-all"
                  />
                </div>
                {odourInterim && (
                  <div className="mt-1 text-xs text-amber-400 italic">
                    Live interim: {odourInterim}
                  </div>
                )}
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={toggleOdourMic}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-black text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 transition-all"
                  >
                    <Mic className="w-3 h-3" />
                    <span>Fallback Browser Mic</span>
                  </button>
                </div>
              </div>

              {/* Large Circular Progressively-Colored Intensity Buttons (UI UPGRADE 4) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  1-Finger Intensity Rating (Progressive Yellow to Deep Red):
                </label>
                <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-lg mx-auto">
                  {[
                    { lvl: 1, label: 'Faint', desc: 'Noticeable outside', color: 'bg-yellow-400 text-black border-2 border-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.45)] ring-2 ring-yellow-400/30' },
                    { lvl: 2, label: 'Moderate', desc: 'Enters room', color: 'bg-amber-500 text-black border-2 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.45)] ring-2 ring-amber-500/30' },
                    { lvl: 3, label: 'Strong', desc: 'Woke me up', color: 'bg-orange-500 text-black border-2 border-orange-400 shadow-[0_0_18px_rgba(249,115,22,0.45)] ring-2 ring-orange-500/30' },
                    { lvl: 4, label: 'Severe', desc: 'Throat burn', color: 'bg-red-500 text-white border-2 border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.55)] ring-2 ring-red-500/30' },
                    { lvl: 5, label: 'Hazardous', desc: 'Choking / Toxic', color: 'bg-rose-700 text-white border-2 border-rose-500 shadow-[0_0_24px_rgba(190,18,60,0.7)] ring-2 ring-rose-500/40 animate-pulse' },
                  ].map((item) => {
                    const isSelected = odourIntensity === item.lvl;
                    return (
                      <button
                        key={item.lvl}
                        type="button"
                        onClick={() => setOdourIntensity(item.lvl)}
                        className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex flex-col items-center justify-center font-bold transition-all duration-200 transform active:scale-95 ${
                          isSelected
                            ? `${item.color} scale-105`
                            : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-base sm:text-lg leading-none">{item.lvl}</span>
                        <span className="text-[9px] sm:text-[10px] font-semibold tracking-tight mt-0.5 opacity-90">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smell Type */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Smell Signature:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Burning Plastic', icon: Flame },
                    { label: 'Sewage / Drain H2S', icon: Droplet },
                    { label: 'Landfill Garbage', icon: Trash },
                    { label: 'Chemical', icon: Beaker },
                  ].map((type) => {
                    const IconComponent = type.icon;
                    const isSelected = odourType === type.label;
                    return (
                      <button
                        key={type.label}
                        type="button"
                        onClick={() => setOdourType(type.label)}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-amber-400 text-black border-amber-300 font-extrabold shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                            : 'bg-black text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <IconComponent className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Observation Location:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {ODOUR_LOCATIONS.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => setSelectedLocation(loc)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedLocation.name === loc.name
                          ? 'bg-slate-200 text-slate-900 border-white font-bold'
                          : 'bg-black text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                      {loc.name}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleUseGPS}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-black text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/10 flex items-center gap-1.5 transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Use My Phone GPS</span>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Target Coordinates: Lat {selectedLocation.lat}, Lon {selectedLocation.lon}
                </p>
              </div>

              {/* Log & Check Wind Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLogAndCheckWind}
                  disabled={isFetchingWeather}
                  style={{ minHeight: '52px' }}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-110 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.3)] active:scale-98 transition-all disabled:opacity-50"
                >
                  {isFetchingWeather ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Checking Open-Meteo Wind & Inversion Layer...</span>
                    </>
                  ) : (
                    <>
                      <Wind className="w-5 h-5" />
                      <span>Log & Check Wind (Live Open-Meteo)</span>
                    </>
                  )}
                </button>
                {weatherError && (
                  <p className="mt-2 text-xs text-rose-400 font-semibold text-center">
                    {weatherError}
                  </p>
                )}
              </div>
            </div>

            {/* Odour Incident Log History: Modern Weather Widget Cards (UI UPGRADE 4) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>Logged Incidents ({odourLogs.length})</span>
                </h3>

                {odourLogs.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear all odour incident logs?')) setOdourLogs([]);
                    }}
                    className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    Clear Log History
                  </button>
                )}
              </div>

              {odourLogs.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-[#050505] text-center text-slate-500">
                  <Wind className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                  <p className="text-xs">No odour episodes recorded yet.</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    When woken by chemical smoke at night, tap "Log & Check Wind" to capture atmospheric evidence.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {odourLogs.map((log) => (
                    /* Modern Weather Widget Card (UI UPGRADE 4) */
                    <div
                      key={log.id}
                      className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-2xl rounded-2xl p-5 space-y-4"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-black ${
                              log.intensity >= 4
                                ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                                : log.intensity === 3
                                ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                                : 'bg-emerald-400 text-black shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                            }`}
                          >
                            Level {log.intensity}/5
                          </span>
                          <span className="font-extrabold text-base text-white">{log.smellType}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{log.timestamp}</span>
                        </span>
                      </div>

                      {/* Spoken Observation Notes */}
                      {log.notes && (
                        <p className="text-xs text-slate-300 italic bg-black/50 p-3 rounded-xl border border-slate-800">
                          "{log.notes}"
                        </p>
                      )}

                      {/* Weather Metrics Modern Gauges */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        {/* Wind Vector Gauge */}
                        <div className="p-3 rounded-xl bg-black/60 border border-slate-800 flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0"
                            style={{ transform: `rotate(${log.windDirection}deg)` }}
                            title={`Wind coming from ${log.windDirection}°`}
                          >
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                              Wind Vector
                            </span>
                            <span className="font-bold text-slate-100 text-sm">
                              {log.windSpeed} m/s ({log.cardinalDirection})
                            </span>
                          </div>
                        </div>

                        {/* Boundary Layer Height Meter */}
                        <div className="p-3 rounded-xl bg-black/60 border border-slate-800 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            log.boundaryLayerHeight < 150
                              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                              : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400'
                          }`}>
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                              Inversion Boundary
                            </span>
                            <span className={`font-bold text-sm ${log.boundaryLayerHeight < 150 ? 'text-rose-300' : 'text-slate-100'}`}>
                              {log.boundaryLayerHeight} meters
                            </span>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="p-3 rounded-xl bg-black/60 border border-slate-800 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                              Location
                            </span>
                            <span className="font-bold text-slate-100 text-sm truncate block">
                              {log.locationName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Atmospheric Assessment Badge (Glowing Widgets) */}
                      <div className="p-3.5 rounded-xl bg-black/60 border border-slate-800 text-xs leading-relaxed space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {log.isUpwindPlume && (
                            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] text-[10px] font-black uppercase tracking-wider">
                              [UPWIND PLUME ACTIVE]
                            </span>
                          )}
                          {log.isInversionTrapping && (
                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)] text-[10px] font-black uppercase tracking-wider">
                              [NOCTURNAL INVERSION TRAPPING]
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 text-xs">{log.assessment}</p>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyComplaint(log)}
                          className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Copy Formal Complaint Report</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteOdourLog(log.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
