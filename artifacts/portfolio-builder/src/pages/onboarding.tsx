import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronRight, FileText, Globe2, Info, Layers3, Loader2, LockKeyhole, Pencil, Rocket, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { getGetCurrentPortfolioQueryKey, getListTemplatesQueryKey, useCreatePortfolio, useGetCurrentPortfolio, useListTemplates, useParseResume, usePublishPortfolio, useUpdatePortfolio } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { queryClient, blankContent, readOnboardingDraft, saveOnboardingDraft } from '@/lib/folio-data';
import { useAuth } from '@/lib/auth';
import { Button, Brand } from '@/components/folio-ui';
import { BrowserPreview } from './workspace';
import './workspace.css';

const steps = [
  { label: 'Your resume', short: 'Resume', hint: 'Start with what you have', href: '/onboarding/upload' },
  { label: 'Your story', short: 'Details', hint: 'Make the introduction yours', href: '/onboarding/details' },
  { label: 'Your direction', short: 'Direction', hint: 'Tell us what’s next', href: '/onboarding/profession' },
  { label: 'Your design', short: 'Design', hint: 'Find a look you love', href: '/onboarding/templates' },
  { label: 'Ready to share', short: 'Publish', hint: 'Preview your new home', href: '/onboarding/preview' },
];

export function Steps({ current }: { current: number }) {
  return <ol className="onboard-step-list" aria-label="Portfolio setup progress">{steps.map((step, index) => <li key={step.label} className={index === current ? 'is-current' : index < current ? 'is-complete' : ''} aria-current={index === current ? 'step' : undefined}>{index < current ? <Link href={step.href}><span className="onboard-step-number"><Check size={15} /></span><span><strong>{step.label}</strong><small>{step.hint}</small></span></Link> : <div><span className="onboard-step-number">{index + 1}</span><span><strong>{step.label}</strong><small>{step.hint}</small></span></div>}</li>)}</ol>;
}

export function OnboardingLayout({ current, children, title, eyebrow }: { current: number; children: ReactNode; title: string; eyebrow?: string }) {
  const reduced = useReducedMotion();
  return <main className="onboard-shell"><header className="onboard-header"><Brand /><Link href="/dashboard" data-testid="link-skip-onboarding" className="studio-subtle-link">Exit setup <X size={15} /></Link></header><div className="onboard-layout"><aside className="onboard-sidebar"><div className="onboard-sidebar-intro"><span className="studio-tag"><Sparkles size={13} />Your next chapter</span><h2>Good work deserves<br />a great first impression.</h2><p>A few small steps to a place that’s entirely yours.</p></div><Steps current={current} /><div className="onboard-sidebar-note"><ShieldCheck size={20} /><div><strong>You’re in control.</strong><p>Review your details before publishing. You decide what the world sees.</p></div></div></aside><motion.div className={`onboard-main ${current === 3 || current === 4 ? 'onboard-main-wide' : ''}`} initial={reduced ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .28 }}><div className="onboard-mobile-progress"><span>Step {current + 1} of 5</span><strong>{steps[current]?.short}</strong><div><i style={{ width: `${(current + 1) * 20}%` }} /></div></div><div className="onboard-title"><span className="onboard-step-caption">Step {current + 1} of 5 <span /> {steps[current]?.short}</span><h1>{title}</h1>{eyebrow && <p>{eyebrow}</p>}</div>{children}</motion.div></div></main>;
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`onboard-notice ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}><Info size={17} /><span>{children}</span></div>;
}

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const auth = useAuth();
  const parse = useParseResume();
  const [, navigate] = useLocation();
  const selectFile = (next?: File) => {
    setError(''); parse.reset();
    if (!next) return;
    if (!/\.(pdf|docx)$/i.test(next.name)) { setFile(null); setError('Choose a PDF or DOCX file. Other formats aren’t supported yet.'); return; }
    if (next.size > 10 * 1024 * 1024 || next.size === 0) { setFile(null); setError(next.size === 0 ? 'This file is empty. Choose another resume.' : 'This resume is larger than 10 MB. Choose a smaller file.'); return; }
    setFile(next);
  };
  const submit = () => {
    if (!file) return;
    if (!auth.authenticated) {
      saveOnboardingDraft({ fileName: file.name, content: readOnboardingDraft().content || blankContent, warnings: ['Resume reading isn’t connected yet. Add your details manually below.'] });
      navigate('/onboarding/details'); return;
    }
    parse.mutate({ data: { file } }, { onSuccess: (result: any) => {
      const existing = readOnboardingDraft();
      saveOnboardingDraft({ fileName: result.fileName, content: existing.content || result.extracted || blankContent, warnings: result.warnings?.length ? result.warnings : ['Review every extracted field before publishing.'] });
      navigate('/onboarding/details');
    } });
  };
  const manual = () => { const existing = readOnboardingDraft(); saveOnboardingDraft({ content: existing.content || blankContent, warnings: [] }); navigate('/onboarding/details'); };
  return <OnboardingLayout current={0} title="Let’s start with your story." eyebrow="Bring your resume, or introduce yourself from scratch."><div className="onboard-content"><label htmlFor="resume-file" className={`onboard-dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={event => { event.preventDefault(); if (!parse.isPending) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!parse.isPending) selectFile(event.dataTransfer.files[0]); }} data-testid="dropzone-resume"><input id="resume-file" type="file" accept=".pdf,.docx" className="sr-only" disabled={parse.isPending} onChange={event => selectFile(event.target.files?.[0])} data-testid="input-resume-file" /><span className="onboard-upload-icon">{file ? <FileText size={28} /> : <Upload size={27} />}{file && <span><Check size={12} /></span>}</span>{file ? <><strong className="onboard-file-name">{file.name}</strong><p>{(file.size / 1024 / 1024).toFixed(2)} MB <span>•</span> File selected</p><span className="onboard-browse">Choose a different file</span></> : <><strong>Drop your resume right here</strong><p>PDF or DOCX, up to 10 MB</p><span className="onboard-browse">Browse files <ArrowRight size={14} /></span></>}</label><Notice>Your resume is read securely, then you review every field before anything is published.</Notice>{(error || parse.isError) && <Notice error>{error || 'We couldn’t continue with this file. Try again, or choose manual entry below.'}</Notice>}<div className="onboard-actions"><span className="onboard-private"><LockKeyhole size={14} />Review before publishing</span><Button onClick={submit} disabled={!file || parse.isPending} data-testid="button-parse-resume">{parse.isPending ? <><Loader2 size={16} className="animate-spin" />Reading your resume…</> : <>Continue <ArrowRight size={16} /></>}</Button></div><div className="onboard-or"><span />or<span /></div><button className="onboard-manual" onClick={manual} data-testid="button-start-manually"><span className="onboard-manual-icon"><Pencil size={18} /></span><span><strong>Start without a resume</strong><small>A blank page is a great place to begin.</small></span><ChevronRight size={19} /></button></div></OnboardingLayout>;
}

export function DetailsPage() {
  const [draft] = useState(readOnboardingDraft);
  const original = { ...blankContent.personalInfo, ...draft.content?.personalInfo };
  const [personal, setPersonal] = useState(original);
  const [links, setLinks] = useState({ ...blankContent.socialLinks, ...draft.content?.socialLinks });
  const [showLinks, setShowLinks] = useState(Boolean(Object.values(draft.content?.socialLinks || {}).some(Boolean)));
  const [, navigate] = useLocation();
  const edit = (field: string, value: string) => { const next = { ...personal, [field]: value }; setPersonal(next); saveOnboardingDraft({ content: { ...(draft.content || blankContent), personalInfo: next, socialLinks: links } }); };
  const editLink = (field: string, value: string) => { const next = { ...links, [field]: value }; setLinks(next); saveOnboardingDraft({ content: { ...(draft.content || blankContent), personalInfo: personal, socialLinks: next } }); };
  const submit = () => { saveOnboardingDraft({ content: { ...(draft.content || blankContent), personalInfo: { ...personal, name: personal.name.trim(), headline: personal.headline.trim() }, socialLinks: links } }); navigate('/onboarding/profession'); };
  return <OnboardingLayout current={1} title="Make the introduction yours." eyebrow="A few details help people get to know the person behind the work."><form className="onboard-content" onSubmit={event => { event.preventDefault(); submit(); }}>{draft.warnings?.length > 0 && <Notice>{draft.warnings[0]}</Notice>}<div className="studio-card onboard-form-card"><div className="onboard-form-heading"><div><h2>The essentials</h2><p>You can add projects and experience in your workspace.</p></div><Pencil size={19} /></div><div className="studio-form-grid"><label className="studio-field"><span>Full name <small>Required</small></span><input className="studio-input" required maxLength={120} autoComplete="name" value={personal.name} onChange={event => edit('name', event.target.value)} placeholder="Your name" data-testid="input-review-name" /></label><label className="studio-field"><span>Professional headline <small>Required</small></span><input className="studio-input" required maxLength={200} value={personal.headline} onChange={event => edit('headline', event.target.value)} placeholder="What you do, in a few words" data-testid="input-review-headline" /></label><label className="studio-field"><span>Email <small>Optional</small></span><input className="studio-input" type="email" autoComplete="email" value={personal.email} onChange={event => edit('email', event.target.value)} placeholder="hello@example.com" data-testid="input-review-email" /></label><label className="studio-field"><span>Location <small>Optional</small></span><input className="studio-input" autoComplete="address-level2" value={personal.location} onChange={event => edit('location', event.target.value)} placeholder="City, country" data-testid="input-review-location" /></label></div><label className="studio-field studio-field-area"><span>A little about you <small>Optional</small></span><textarea className="studio-input" rows={4} value={personal.summary} onChange={event => edit('summary', event.target.value)} maxLength={5000} placeholder="Tell people what you enjoy doing, what you’ve worked on, and what you’re looking for next." data-testid="input-review-summary" /></label><p className="studio-field-help">Write in your own voice. A few clear sentences are plenty.</p><button type="button" className="onboard-expand" onClick={() => setShowLinks(!showLinks)} aria-expanded={showLinks} aria-controls="onboarding-links">Add social links & contact details <ChevronRight size={17} className={showLinks ? 'rotate-90' : ''} /></button>{showLinks && <div id="onboarding-links" className="studio-form-grid"><label className="studio-field"><span>GitHub</span><input className="studio-input" value={links.github} onChange={e => editLink('github', e.target.value)} placeholder="https://github.com/you" /></label><label className="studio-field"><span>LinkedIn</span><input className="studio-input" value={links.linkedin} onChange={e => editLink('linkedin', e.target.value)} placeholder="https://linkedin.com/in/you" /></label><label className="studio-field"><span>Website</span><input className="studio-input" value={links.website} onChange={e => editLink('website', e.target.value)} placeholder="https://your-website.com" /></label><label className="studio-field"><span>Phone</span><input className="studio-input" type="tel" autoComplete="tel" value={personal.phone} onChange={e => edit('phone', e.target.value)} placeholder="Optional contact number" /></label><label className="studio-field"><span>Photo URL</span><input className="studio-input" value={personal.avatar || ''} onChange={e => edit('avatar', e.target.value)} placeholder="https://… (optional)" /></label></div>}<p className="studio-field-help"><ShieldCheck size={14} />Only include contact details you want to make public.</p></div><div className="onboard-actions"><Link href="/onboarding/upload" className="studio-subtle-link"><ArrowLeft size={15} />Back</Link><Button type="submit" disabled={!personal.name.trim() || !personal.headline.trim()} data-testid="link-continue-review">Looks good <ArrowRight size={16} /></Button></div></form></OnboardingLayout>;
}

const purposes = [
  ['Job Search', 'Land your next opportunity'], ['Freelancing', 'Turn visitors into clients'], ['Personal Branding', 'Build your presence online'], ['Consulting', 'Share your expertise'], ['Showcase Projects', 'Let your work take the lead'], ['Networking', 'Make new connections'],
];

export function ProfessionPage() {
  const draft = readOnboardingDraft();
  const [profession, setProfession] = useState(draft.profession || 'Software Developer');
  const [purpose, setPurpose] = useState(draft.purpose || 'Job Search');
  const chooseProfession = (next: string) => { setProfession(next); saveOnboardingDraft({ profession: next }); };
  const choosePurpose = (next: string) => { setPurpose(next); saveOnboardingDraft({ purpose: next }); };
  return <OnboardingLayout current={2} title="What’s your next chapter?" eyebrow="Your background and goals help you choose the right design."><div className="onboard-content"><div className="studio-card onboard-form-card"><label className="studio-field"><span>What kind of work do you do?</span><select className="studio-input" value={profession} onChange={e => chooseProfession(e.target.value)} data-testid="select-profession">{['Software Developer', 'AI Engineer', 'Data Scientist', 'Product Manager', 'UI/UX Designer', 'Writer', 'Photographer', 'Consultant', 'Marketing Professional', 'Teacher', 'Researcher', 'Student', 'Other Professional'].map(item => <option key={item}>{item}</option>)}</select></label><fieldset className="onboard-purpose"><legend>What would you like your portfolio to help with?</legend><div className="onboard-purpose-grid">{purposes.map(([title, subtitle]) => <button type="button" key={title} onClick={() => choosePurpose(title)} aria-pressed={purpose === title} className={purpose === title ? 'is-selected' : ''} data-testid={`button-purpose-${title.toLowerCase().replaceAll(' ', '-')}`}><span className="onboard-purpose-radio">{purpose === title && <Check size={12} />}</span><strong>{title}</strong><small>{subtitle}</small></button>)}</div></fieldset></div><div className="onboard-actions"><Link href="/onboarding/details" className="studio-subtle-link"><ArrowLeft size={15} />Back</Link><Link href="/onboarding/templates" onClick={() => saveOnboardingDraft({ profession, purpose })} data-testid="link-continue-profession" className="studio-primary-link">Explore designs <ArrowRight size={16} /></Link></div></div></OnboardingLayout>;
}

export function PreviewPage() {
  const auth = useAuth();
  const create = useCreatePortfolio();
  const currentQuery = useGetCurrentPortfolio({ query: { queryKey: getGetCurrentPortfolioQueryKey(), retry: false, enabled: auth.authenticated } });
  const templates = useListTemplates({ query: { queryKey: getListTemplatesQueryKey() } });
  const update = useUpdatePortfolio();
  const publish = usePublishPortfolio();
  const [, navigate] = useLocation();
  const [draft] = useState(readOnboardingDraft);
  const current = currentQuery.data;
  const [createdId, setCreatedId] = useState<string | null>(null);
  const content = draft.content || current?.content || blankContent;
  const profession = draft.profession || current?.profession || 'Other Professional';
  const purpose = draft.purpose || current?.purpose || 'Personal Branding';
  const templateId = draft.templateId || current?.templateId || 'clean-professional';
  const portfolio = { ...current, slug: current?.slug || '', profession, purpose, templateId, content };
  const selected = templates.data?.find(template => template.id === templateId);
  const busy = create.isPending || update.isPending || publish.isPending;
  const hasName = Boolean(content.personalInfo?.name?.trim());
  const loadError = currentQuery.isError && currentQuery.error?.status !== 404;
  const createOrPublish = async () => {
    if (!auth.authenticated) { navigate('/login?returnTo=%2Fonboarding%2Fpreview'); return; }
    create.reset(); update.reset(); publish.reset();
    try {
      const id = current?.id || createdId;
      const result = id ? await update.mutateAsync({ id, data: { profession, purpose, templateId, content } }) : await create.mutateAsync({ data: { profession, purpose, templateId, content } });
      setCreatedId(result.id);
      queryClient.setQueryData(getGetCurrentPortfolioQueryKey(), result);
      const published = await publish.mutateAsync({ id: result.id });
      queryClient.setQueryData(getGetCurrentPortfolioQueryKey(), published);
      sessionStorage.removeItem('folio-onboarding');
      navigate('/dashboard/portfolio');
    } catch { /* The mutation state keeps the draft and displays a recoverable error. */ }
  };
  return <OnboardingLayout current={4} title="Your story. A whole new home." eyebrow="Take a look around. You can keep editing after you publish."><div className="onboard-preview-grid"><section className="studio-card studio-preview-card"><div className="studio-card-heading"><h2>Your portfolio preview</h2><span className="studio-tag">{selected?.name || 'Your chosen design'}</span></div><BrowserPreview portfolio={portfolio} controls /><div className="studio-preview-footer"><span>Built around your details</span><Link href="/onboarding/details">Edit introduction <Pencil size={14} /></Link></div></section><aside className="studio-card studio-card-pad onboard-publish-card"><span className="studio-empty-icon"><Rocket size={24} /></span><h2>Ready for your next opportunity?</h2><p className="studio-description">Publish your portfolio and get a link you can add to your applications, social profiles, and email signature.</p><ul className="onboard-publish-list"><li><Globe2 size={17} />Your own shareable link</li><li><Layers3 size={17} />{selected?.name || 'Your selected template'}</li><li><Pencil size={17} />Keep editing as you grow</li></ul>{!hasName && <Notice error>Add your name in the details step before publishing.</Notice>}{loadError && <Notice error>Your saved portfolio couldn’t be checked. <button type="button" className="underline" onClick={() => void currentQuery.refetch()}>Try again</button> before publishing.</Notice>}{(create.isError || update.isError || publish.isError) && <Notice error>{publish.isError ? 'Your draft is saved, but publishing didn’t finish. Try again.' : 'Your portfolio couldn’t be saved. Your details are still here; please try again.'}</Notice>}<Button className="w-full" onClick={() => void createOrPublish()} disabled={busy || !hasName || (auth.authenticated && currentQuery.isLoading) || loadError || auth.isLoading} data-testid="button-publish-onboarding">{busy ? <Loader2 size={17} className="animate-spin" /> : <Rocket size={17} />}{busy ? 'Publishing your portfolio…' : auth.authenticated ? 'Publish portfolio' : 'Sign in to publish'}</Button><p className="studio-field-help"><LockKeyhole size={13} />You can unpublish at any time.</p></aside></div><Link href="/onboarding/templates" className="studio-subtle-link onboard-back"><ArrowLeft size={15} />Back to designs</Link></OnboardingLayout>;
}
