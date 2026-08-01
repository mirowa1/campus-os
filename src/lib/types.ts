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

export interface ParsedSyllabus {
  name: string;
  code: string | null;
  term: string | null;
  assessments: ParsedAssessment[];
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
  state: string | null;
  phone: string | null;
  work_email: string | null;
  linkedin: string | null;
  professional_title: string | null;
  school: string | null;
  major: string | null;
  concentration: string | null;
  minor: string | null;
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

