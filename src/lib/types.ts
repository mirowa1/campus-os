export type AssessmentType = "assignment" | "quiz" | "exam" | "other";

export type RiskStatus = "on_track" | "at_risk" | "failing_risk" | "insufficient_data";

export interface Profile {
  id: string;
  email: string;
  created_at: string;
  full_name: string | null;
  major: string | null;
  expected_grad_term: string | null;
  /** Private — owner-only via profiles RLS. Never put in shared/public storage. */
  student_id: string | null;
  avatar_path: string | null;
  /** First-touch marketing attribution; set once at signup, never overwritten. */
  signup_utm_source: string | null;
  signup_utm_medium: string | null;
  signup_utm_campaign: string | null;
  signup_utm_content: string | null;
}

export interface ClassRow {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  term: string | null;
  target_letter: string | null;
  target_percent: number | null;
  created_at: string;
  syllabus_path: string | null;
  syllabus_file_name: string | null;
}

export interface AssessmentRow {
  id: string;
  class_id: string;
  title: string;
  type: AssessmentType;
  due_date: string | null;
  weight_percent: number;
  score: number | null;
  max_score: number;
  created_at: string;
}

export interface ParsedAssessment {
  title: string;
  type: AssessmentType;
  due_date: string | null;
  weight_percent: number;
}

/** Recurring class meeting block from syllabus (e.g. MWF 10:00–10:50). */
export interface ParsedClassMeeting {
  day_of_week: number; // 0=Sunday … 6=Saturday
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;
  location: string | null;
  term_start_date: string | null; // YYYY-MM-DD
  term_end_date: string | null;
}

export interface ParsedSyllabus {
  name: string;
  code: string | null;
  term: string | null;
  assessments: ParsedAssessment[];
  meetings: ParsedClassMeeting[];
}

export interface ClassMeetingRow {
  id: string;
  class_id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  term_start_date: string | null;
  term_end_date: string | null;
  created_at: string;
}

export interface ClassWithAssessments extends ClassRow {
  assessments: AssessmentRow[];
}

export interface NoteRow {
  id: string;
  class_id: string;
  title: string;
  body: string;
  updated_at: string;
}

export interface CourseMaterialRow {
  id: string;
  class_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  created_at: string;
}

export interface StudyGuideRow {
  id: string;
  class_id: string;
  content: string;
  created_at: string;
}

/** Personal calendar reminder/task — not used in grade math. */
export interface CalendarEventRow {
  id: string;
  user_id: string;
  class_id: string | null;
  title: string;
  event_date: string;
  created_at: string;
}

export interface ResumeRow {
  id: string;
  user_id: string;
  template_choice: string | null;
  current_step: number;
  created_at: string;
  updated_at: string;
  generated_content: TailoredResumeContent | null;
  generated_html: string | null;
}

export interface ResumeCertification {
  label: string;
  isCustom: boolean;
}

export interface ResumeProjectEntry {
  title: string;
  description: string;
  dateContext: string;
}

export interface ResumeExperienceEntry {
  title: string;
  company: string;
  location: string;
  state: string;
  endDate: string;
  bullets: string[];
}

export interface ResumeDataRow {
  resume_id: string;
  full_name: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  work_email: string | null;
  linkedin: string | null;
  professional_title: string | null;
  school: string | null;
  major: string | null;
  concentration: string | null;
  minor: string | null;
  education_location: string | null;
  education_state: string | null;
  achievements: string[];
  certifications: ResumeCertification[];
  projects: ResumeProjectEntry[];
  extracurriculars: string[];
  experience: ResumeExperienceEntry[];
}

/** Claude-tailored resume JSON for preview + PDF. */
export interface TailoredResumeContent {
  summary?: string | null;
  professionalSkills?: string[];
  technicalSkills?: string[];
  education: {
    school: string;
    degreeLine: string;
    location?: string | null;
    state?: string | null;
    date?: string | null;
    details?: string[];
  };
  experience: {
    title: string;
    company: string;
    location: string;
    state?: string;
    endDate: string;
    bullets: string[];
  }[];
  projects?: { title: string; description: string; dateContext: string }[];
  extracurriculars?: string[];
  certifications?: string[];
  achievements?: string[];
  additional?: string[];
}

export type ResumeTemplateId = "A" | "B" | "C";

export type QuizMode = "quiz" | "flashcard";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface QuizSetRow {
  id: string;
  class_id: string;
  mode: QuizMode;
  title: string;
  source_refs: Record<string, unknown>;
  content: QuizQuestion[] | FlashcardItem[];
  created_at: string;
}

export interface QuizAnswerRecord {
  questionIndex: number;
  selectedIndex: number;
  correct: boolean;
}

export interface QuizAttemptRow {
  id: string;
  quiz_set_id: string;
  score: number | null;
  answers: QuizAnswerRecord[];
  known_cards: number[];
  completed_at: string | null;
  created_at: string;
}

