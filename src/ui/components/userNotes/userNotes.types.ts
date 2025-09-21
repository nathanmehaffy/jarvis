export interface UserNotesState {
  content: string;
  lastModified: Date;
}

export interface UserNotesProps {
  placeholder?: string;
  windowId?: string;
}