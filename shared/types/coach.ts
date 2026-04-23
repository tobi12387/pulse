export interface CheckIn {
  id: string;
  date: string;
  energy_level: number;
  stress_level: number;
  notes: string | null;
}

export interface DailyBriefing {
  id: string;
  date: string;
  trigger_type: 'check-in' | 'garmin-alarm';
  briefing_text: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface CheckInTodayResponse {
  checkin: CheckIn | null;
}

export interface BriefingLatestResponse {
  briefing: DailyBriefing | null;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export interface ChatMessageResponse {
  response: string;
}
