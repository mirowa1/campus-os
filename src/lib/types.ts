export type AssessmentType = "assignment" | "quiz" | "exam" | "other";

export type RiskStatus = "on_track" | "at_risk" | "failing_risk" | "insufficient_data";

export interface Profile {
  id: string;
  email: string;
  created_at: string;
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
