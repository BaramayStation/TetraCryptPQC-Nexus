
/**
 * TetraCryptPQC Storage Utility
 * Provides secure storage mechanisms for cryptographic keys and messages
 */

import { UserProfile as UserProfileType, Contact as ContactType, Message as MessageType } from "./storage-types";

// In-memory storage
const storage = {
  currentUser: null as UserProfileType | null,
  contacts: [] as ContactType[],
  messages: [] as MessageType[],
};

/**
 * Save user profile to storage
 */
export function saveUserProfile(profile: UserProfileType): void {
  storage.currentUser = profile;
  localStorage.setItem('userProfile', JSON.stringify(profile));
  console.log("User profile saved:", profile.userId);
}

/**
 * Get current user profile
 */
export function getUserProfile(): UserProfileType | null {
  if (!storage.currentUser) {
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile) {
      storage.currentUser = JSON.parse(storedProfile);
    }
  }
  return storage.currentUser;
}

/**
 * Save a contact
 */
export function saveContact(contact: ContactType): void {
  const existingIndex = storage.contacts.findIndex(c => c.id === contact.id);
  if (existingIndex >= 0) {
    storage.contacts[existingIndex] = contact;
  } else {
    storage.contacts.push(contact);
  }
  localStorage.setItem('contacts', JSON.stringify(storage.contacts));
  console.log("Contact saved:", contact.id);
}

/**
 * Get all contacts
 */
export function getContacts(): ContactType[] {
  if (storage.contacts.length === 0) {
    const storedContacts = localStorage.getItem('contacts');
    if (storedContacts) {
      storage.contacts = JSON.parse(storedContacts);
    }
  }
  
  // Ensure all contacts have the required signatureKey property
  storage.contacts = storage.contacts.map(contact => {
    if (!contact.signatureKey) {
      return {
        ...contact,
        signatureKey: contact.publicKey || "" // Fallback to publicKey if signatureKey is missing
      };
    }
    return contact;
  });
  
  return storage.contacts;
}

/**
 * Get a contact by ID
 */
export function getContactById(id: string): ContactType | undefined {
  return getContacts().find(contact => contact.id === id);
}

/**
 * Add a message
 */
export function addMessage(message: MessageType): void {
  storage.messages.push(message);
  localStorage.setItem('messages', JSON.stringify(storage.messages));
  console.log("Message added:", message.id);
}

/**
 * Get messages between two users
 */
export function getMessages(userId1: string, userId2: string): MessageType[] {
  if (storage.messages.length === 0) {
    const storedMessages = localStorage.getItem('messages');
    if (storedMessages) {
      storage.messages = JSON.parse(storedMessages);
    }
  }
  
  return storage.messages.filter(message => 
    (message.sender === userId1 && message.receiver === userId2) ||
    (message.sender === userId2 && message.receiver === userId1)
  );
}

/**
 * Get messages for a contact
 */
export function getMessagesForContact(contactId: string): MessageType[] {
  const user = getUserProfile();
  if (!user) return [];
  
  return getMessages(user.userId, contactId);
}

/**
 * Mark messages as read
 */
export function markMessagesAsRead(contactId: string): void {
  const user = getUserProfile();
  if (!user) return;
  
  storage.messages.forEach(message => {
    if (message.sender === contactId && message.receiver === user.userId) {
      message.status = 'read';
    }
  });
  
  localStorage.setItem('messages', JSON.stringify(storage.messages));
}

/**
 * Clear all storage data
 */
export function clearAllData(): void {
  storage.currentUser = null;
  storage.contacts = [];
  storage.messages = [];
  localStorage.removeItem('userProfile');
  localStorage.removeItem('contacts');
  localStorage.removeItem('messages');
  console.log("Storage cleared");
}

/**
 * Clear all storage (for testing/development)
 */
export function clearStorage(): void {
  clearAllData();
}

// Re-export the types from storage-types.ts
export type UserProfile = UserProfileType;
export type Contact = ContactType;
export type Message = MessageType;
