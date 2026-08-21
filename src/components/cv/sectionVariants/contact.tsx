import { InlineInput } from "../InlineEdit";
import type { ContactVariantProps } from "./types";

const LOCATION_ICON = "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z";
const EMAIL_ICON = "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
const PHONE_ICON = "M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z";
const LINKEDIN_PATH = "M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z";

function IconStroke({ d, color }: { d: string; color?: string }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

export function ContactStacked({ contact, theme, onUpdateField }: ContactVariantProps) {
  return (
    <div className="space-y-1.5 md:text-right flex-shrink-0" style={theme.muted}>
      {contact.location && (
        <div className="flex items-center md:justify-end gap-1.5">
          <IconStroke d={LOCATION_ICON} color={theme.contactIcon.color} />
          <InlineInput value={contact.location} onSave={v => onUpdateField("location", v)} placeholder="Location" />
        </div>
      )}
      {contact.email && (
        <div className="flex items-center md:justify-end gap-1.5">
          <IconStroke d={EMAIL_ICON} color={theme.contactIcon.color} />
          <InlineInput value={contact.email} onSave={v => onUpdateField("email", v)} placeholder="email@example.com" />
        </div>
      )}
      {contact.phone && (
        <div className="flex items-center md:justify-end gap-1.5">
          <IconStroke d={PHONE_ICON} color={theme.contactIcon.color} />
          <InlineInput value={contact.phone} onSave={v => onUpdateField("phone", v)} placeholder="+1 234 567 890" />
        </div>
      )}
      {contact.linkedin && (
        <div className="flex items-center md:justify-end gap-1.5">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: theme.contactIcon.color }}><path d={LINKEDIN_PATH} /></svg>
          <InlineInput value={contact.linkedin} onSave={v => onUpdateField("linkedin", v)} placeholder="linkedin.com/in/..." />
        </div>
      )}
    </div>
  );
}

export function ContactBadges({ contact, theme, onUpdateField }: ContactVariantProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-medium" style={theme.muted}>
      {contact.location && (
        <div className="flex items-center gap-1.5">
          <IconStroke d={LOCATION_ICON} color={theme.contactIcon.color} />
          <InlineInput value={contact.location} onSave={v => onUpdateField("location", v)} placeholder="Location" />
        </div>
      )}
      {contact.phone && (
        <div className="flex items-center gap-1.5">
          <IconStroke d={PHONE_ICON} color={theme.contactIcon.color} />
          <InlineInput value={contact.phone} onSave={v => onUpdateField("phone", v)} placeholder="+1 234 567 890" />
        </div>
      )}
      {contact.email && (
        <div className="flex items-center gap-1.5">
          <IconStroke d={EMAIL_ICON} color={theme.contactIcon.color} />
          <InlineInput value={contact.email} onSave={v => onUpdateField("email", v)} placeholder="email@example.com" />
        </div>
      )}
      {contact.linkedin && (
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: theme.contactIcon.color }}><path d={LINKEDIN_PATH} /></svg>
          <InlineInput value={contact.linkedin} onSave={v => onUpdateField("linkedin", v)} placeholder="linkedin.com/in/..." />
        </div>
      )}
    </div>
  );
}
