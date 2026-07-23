'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/client';
import type { Job } from '@/types';

interface NetworkingTabProps {
  job: Job;
}

interface Contact {
  name: string;
  role?: string;
  relationship?: string;
  email?: string;
  linkedin?: string;
}

export default function NetworkingTab({ job }: NetworkingTabProps) {
  const queryClient = useQueryClient();
  const [contacts, setContacts] = useState<Contact[]>(job.known_contacts || []);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContact, setNewContact] = useState<Contact>({
    name: '',
    role: '',
    relationship: '',
    email: '',
    linkedin: '',
  });

  const [selectedOutreach, setSelectedOutreach] = useState<{
    type: 'known_contact' | 'cold_linkedin' | 'referral_request';
    contactIndex?: number;
  } | null>(null);
  const [outreachMessage, setOutreachMessage] = useState('');

  const updateContactsMutation = useMutation({
    mutationFn: async (updatedContacts: Contact[]) => {
      await jobsApi.updateContacts(job.id, updatedContacts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', job.id] });
    },
  });

  const generateOutreachMutation = useMutation({
    mutationFn: async (params: {
      message_type: 'known_contact' | 'cold_linkedin' | 'referral_request';
      contact_name?: string;
      contact_role?: string;
      relationship_context?: string;
    }) => {
      const response = await jobsApi.generateOutreachMessage(job.id, params);
      return response.data;
    },
  });

  const handleAddContact = () => {
    if (!newContact.name.trim()) return;
    const updated = [...contacts, newContact];
    setContacts(updated);
    updateContactsMutation.mutate(updated);
    setNewContact({ name: '', role: '', relationship: '', email: '', linkedin: '' });
    setIsAddingContact(false);
  };

  const handleRemoveContact = (index: number) => {
    const updated = contacts.filter((_, i) => i !== index);
    setContacts(updated);
    updateContactsMutation.mutate(updated);
  };

  const handleGenerateOutreach = () => {
    if (!selectedOutreach) return;
    const contact =
      selectedOutreach.contactIndex !== undefined
        ? contacts[selectedOutreach.contactIndex]
        : undefined;

    generateOutreachMutation.mutate(
      {
        message_type: selectedOutreach.type,
        contact_name: contact?.name,
        contact_role: contact?.role,
        relationship_context: contact?.relationship,
      },
      {
        onSuccess: (data) => {
          setOutreachMessage(data.outreach_message);
        },
      }
    );
  };

  const outreachOptionStyle = (selected: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    borderRadius: 8,
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    background: selected ? 'rgba(255,90,31,0.1)' : 'rgba(255,255,255,0.02)',
    border: selected ? '1px solid rgba(255,90,31,0.35)' : '1px solid rgba(255,255,255,0.08)',
    color: 'inherit',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Contacts */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 1 }}>
            CONTACTS AT THIS COMPANY
          </div>
          <button
            onClick={() => setIsAddingContact(true)}
            className="btn-secondary"
            style={{ fontSize: 10, padding: '6px 12px' }}
          >
            + Add Contact
          </button>
        </div>

        {contacts.length === 0 && !isAddingContact && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            No contacts added yet. Add people you know at this company to generate personalized outreach messages.
          </p>
        )}

        {contacts.map((contact, idx) => (
          <div
            key={idx}
            style={{
              padding: 14,
              borderRadius: 8,
              marginBottom: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{contact.name}</h4>
                {contact.role && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{contact.role}</p>}
                {contact.relationship && (
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                    Relationship: {contact.relationship}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: 'var(--teal)' }}>
                      {contact.email}
                    </a>
                  )}
                  {contact.linkedin && (
                    <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--teal)' }}>
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemoveContact(idx)}
                className="btn-ghost danger"
                style={{ fontSize: 10, padding: '4px 8px', flexShrink: 0 }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {isAddingContact && (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: 'rgba(255,90,31,0.06)',
              border: '1px solid rgba(255,90,31,0.2)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Add New Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                placeholder="Name *"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Role (e.g., Senior Engineer)"
                value={newContact.role}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Relationship (e.g., Former colleague)"
                value={newContact.relationship}
                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                className="input-field"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                className="input-field"
              />
              <input
                type="url"
                placeholder="LinkedIn URL (optional)"
                value={newContact.linkedin}
                onChange={(e) => setNewContact({ ...newContact, linkedin: e.target.value })}
                className="input-field"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={handleAddContact}
                  disabled={!newContact.name.trim()}
                  className="btn-primary"
                  style={{ fontSize: 10, padding: '8px 14px' }}
                >
                  Add Contact
                </button>
                <button
                  onClick={() => {
                    setIsAddingContact(false);
                    setNewContact({ name: '', role: '', relationship: '', email: '', linkedin: '' });
                  }}
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: '8px 14px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outreach generator */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 8 }}>
          GENERATE OUTREACH MESSAGE
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          Select a strategy and we&apos;ll generate a personalized message based on your resume and this job posting.
        </p>

        {contacts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, letterSpacing: 0.5 }}>
              REACH OUT TO KNOWN CONTACT
            </div>
            {contacts.map((contact, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOutreach({ type: 'known_contact', contactIndex: idx })}
                style={outreachOptionStyle(
                  selectedOutreach?.type === 'known_contact' && selectedOutreach.contactIndex === idx
                )}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{contact.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{contact.role || 'Contact'}</p>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setSelectedOutreach({ type: 'cold_linkedin' })}
          style={outreachOptionStyle(selectedOutreach?.type === 'cold_linkedin')}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cold LinkedIn Message</p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Reach out to hiring manager on LinkedIn</p>
        </button>

        <button
          onClick={() => setSelectedOutreach({ type: 'referral_request' })}
          style={outreachOptionStyle(selectedOutreach?.type === 'referral_request')}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Referral Request</p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Ask your network for an introduction</p>
        </button>

        <button
          onClick={handleGenerateOutreach}
          disabled={!selectedOutreach || generateOutreachMutation.isPending}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 11, marginTop: 12 }}
        >
          {generateOutreachMutation.isPending ? 'Generating…' : 'Generate Message'}
        </button>

        {generateOutreachMutation.isError && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontSize: 12, color: 'var(--red)' }}>
            {getErrorMessage(generateOutreachMutation.error)}
          </div>
        )}

        {outreachMessage && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Generated Message</div>
              <button
                onClick={() => navigator.clipboard.writeText(outreachMessage)}
                className="btn-ghost"
                style={{ fontSize: 10, padding: '4px 10px' }}
              >
                Copy
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {outreachMessage}
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div style={{ padding: 14, background: 'rgba(255,90,31,0.06)', border: '1px solid rgba(255,90,31,0.15)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Networking Tips</div>
        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 16 }}>
          <li>Referrals increase interview chances by 3–5×</li>
          <li>Personalize the AI-generated message with your own voice</li>
          <li>Mention specific projects or values that resonate with you</li>
          <li>Follow up if you don&apos;t hear back within a week</li>
        </ul>
      </div>
    </div>
  );
}
