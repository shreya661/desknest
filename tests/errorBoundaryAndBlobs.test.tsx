import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { notesRepository } from "../src/repositories/notesRepository";
import { backupRepository } from "../src/repositories/backupRepository";
import { dbPut, STORES, AudioBlobRecord } from "../src/repositories/db";

// Helper component that throws on demand
const FaultyComponent: React.FC<{ shouldThrow?: boolean; message?: string }> = ({
  shouldThrow = true,
  message = "Test render failure",
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>Component rendered successfully</div>;
};

describe("Workspace & Block-Level Error Boundaries", () => {
  // Suppress expected console.error during error boundary tests
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary label="Safe Component">
        <FaultyComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Component rendered successfully")).toBeInTheDocument();
  });

  it("catches render errors and displays workspace fallback UI", () => {
    render(
      <ErrorBoundary label="Notes Workspace">
        <FaultyComponent shouldThrow={true} message="Corrupted state" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Notes Workspace encountered an error")).toBeInTheDocument();
    expect(screen.getByText(/Corrupted state/)).toBeInTheDocument();
    expect(screen.getByText("Copy Diagnostic Info")).toBeInTheDocument();
    expect(screen.getByText("Try Again / Reset")).toBeInTheDocument();
  });

  it("supports compact fallback for block-level embeds", () => {
    render(
      <ErrorBoundary label="Kanban" compact>
        <FaultyComponent shouldThrow={true} message="Invalid column data" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Kanban error:")).toBeInTheDocument();
    expect(screen.getByText("Invalid column data")).toBeInTheDocument();
    expect(screen.getByText("Copy Diagnostic Info")).toBeInTheDocument();
    expect(screen.getByText("Try Again / Reset")).toBeInTheDocument();
  });

  it("resets error state when reset button is clicked", () => {
    const onReset = vi.fn();
    let fail = true;

    const DynamicComponent = () => {
      if (fail) throw new Error("Temporary crash");
      return <div>Recovered!</div>;
    };

    const { rerender } = render(
      <ErrorBoundary label="Dynamic Block" compact onReset={onReset}>
        <DynamicComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Dynamic Block error:")).toBeInTheDocument();

    fail = false;
    fireEvent.click(screen.getByText("Try Again / Reset"));
    expect(onReset).toHaveBeenCalled();

    rerender(
      <ErrorBoundary label="Dynamic Block" compact onReset={onReset}>
        <DynamicComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText("Recovered!")).toBeInTheDocument();
  });
});

describe("Separate Base64 Audio Blobs in IndexedDB", () => {
  beforeEach(async () => {
    await notesRepository.clear();
  });

  it("saves, retrieves, and deletes audio blobs by id", async () => {
    const sampleBlob: AudioBlobRecord = {
      id: "audio_test_123",
      noteId: "note_abc",
      mimeType: "audio/webm;codecs=opus",
      data: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USAExMz4=",
      createdAt: Date.now(),
    };

    await notesRepository.saveAudioBlob(sampleBlob);

    const retrieved = await notesRepository.getAudioBlob("audio_test_123");
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe("audio_test_123");
    expect(retrieved?.noteId).toBe("note_abc");
    expect(retrieved?.data).toBe(sampleBlob.data);

    const noteBlobs = await notesRepository.getAudioBlobsByNoteId("note_abc");
    expect(noteBlobs).toHaveLength(1);
    expect(noteBlobs[0].id).toBe("audio_test_123");

    await notesRepository.deleteAudioBlob("audio_test_123");
    const afterDelete = await notesRepository.getAudioBlob("audio_test_123");
    expect(afterDelete).toBeNull();
  });

  it("notesRepository.list() strips inline audioData from legacy notes", async () => {
    const noteWithInlineAudio: any = {
      id: "note_with_audio",
      title: "Voice Memo Note",
      content: "Voice note content",
      color: "amber",
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      voiceRecordings: [
        {
          id: "rec_1",
          audioData: "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USAExMz4=VERY_LARGE_BASE64_STRING",
          durationSeconds: 15,
          createdAt: new Date().toISOString(),
          transcription: "Meeting minutes",
        },
      ],
    };

    await dbPut(STORES.NOTES, noteWithInlineAudio);

    const listed = await notesRepository.list();
    const found = listed.find((n) => n.id === "note_with_audio");

    expect(found).toBeDefined();
    expect(found?.voiceRecordings?.[0].id).toBe("rec_1");
    // audioData should be stripped from list() output to keep list() fast and lightweight
    expect(found?.voiceRecordings?.[0].audioData).toBeUndefined();
    expect(found?.voiceRecordings?.[0].transcription).toBe("Meeting minutes");
  });

  it("notesRepository.delete() cascade-deletes associated audio blobs", async () => {
    const note = await notesRepository.create({ title: "Note with Audio" });
    const blob: AudioBlobRecord = {
      id: "blob_cascade_1",
      noteId: note.id,
      mimeType: "audio/webm",
      data: "base64audio...",
      createdAt: Date.now(),
    };

    await notesRepository.saveAudioBlob(blob);
    expect(await notesRepository.getAudioBlob("blob_cascade_1")).not.toBeNull();

    await notesRepository.delete(note.id);

    expect(await notesRepository.getById(note.id)).toBeNull();
    expect(await notesRepository.getAudioBlob("blob_cascade_1")).toBeNull();
  });

  it("backupRepository.importData() in overwrite mode clears existing audio blobs", async () => {
    const staleBlob: AudioBlobRecord = {
      id: "stale_blob",
      noteId: "old_note",
      mimeType: "audio/webm",
      data: "stale_data...",
      createdAt: Date.now(),
    };
    await notesRepository.saveAudioBlob(staleBlob);
    expect(await notesRepository.getAudioBlob("stale_blob")).not.toBeNull();

    const emptyBackup = {
      format: "desknest-backup" as const,
      version: 2 as const,
      exportedAt: new Date().toISOString(),
      notes: [],
      tasks: [],
      reminders: [],
      drawings: [],
      notifications: [],
      audioBlobs: [],
    };

    await backupRepository.importData(emptyBackup, "overwrite");
    expect(await notesRepository.getAudioBlob("stale_blob")).toBeNull();
  });
});

