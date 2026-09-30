import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, Code2, Copy, ExternalLink, FileText, Globe2, Image, Info, Layers3, LayoutDashboard, Link2, Loader2, Mail, MapPin, Menu, Monitor, Palette, Pencil, Plus, Rocket, Settings, ShieldCheck, Smartphone, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { getGetCurrentPortfolioQueryKey, getGetPublicPortfolioQueryKey, getListTemplatesQueryKey, useGetCurrentPortfolio, useGetPublicPortfolio, useListTemplates, usePublishPortfolio, useUnpublishPortfolio, useUpdatePortfolio } from '@workspace/api-client-react';
import { Link, useLocation, useParams } from 'wouter';
import { queryClient, blankContent } from '@/lib/folio-data';
import { Button, Brand, TemplateCard } from '@/components/folio-ui';
import './workspace.css';

export const dashLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: Globe2 },
  { href: '/dashboard/content', label: 'Content', icon: FileText },
  { href: '/dashboard/templates', label: 'Templates', icon: Layers3 },
  { href: '/dashboard/appearance', label: 'Appearance', icon: Palette },
  { href: '/dashboard/domain', label: 'Domain', icon: Link2 },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
];

export function usePortfolioData() {
  const query = useGetCurrentPortfolio({ query: { queryKey: getGetCurrentPortfolioQueryKey(), retry: false } });
  return { ...query, portfolio: query.data || null };
}

export function portfolioUrl(slug: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}/p/${encodeURIComponent(slug)}`;
}

export function safeUrl(value?: string | null) {
  if (!value?.trim()) return undefined;
  try {
    const input = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

function updateCache(portfolio: any) {
  queryClient.setQueryData(getGetCurrentPortfolioQueryKey(), portfolio);
  if (portfolio?.slug) void queryClient.invalidateQueries({ queryKey: getGetPublicPortfolioQueryKey(portfolio.slug) });
}

function Feedback({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <div className={`studio-feedback ${success ? 'is-success' : ''}`} role={success ? 'status' : 'alert'}>{success ? <Check size={17} /> : <Info size={17} />}<span>{children}</span></div>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { portfolio } = usePortfolioData();
  const name = portfolio?.content?.personalInfo?.name || 'Your workspace';
  const initials = name.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); };
  }, [open]);
  return <div className="studio-shell">
    <a className="studio-skip" href="#workspace-main">Skip to content</a>
    {open && <button className="studio-overlay" onClick={() => setOpen(false)} aria-label="Close navigation overlay" data-testid="button-sidebar-overlay" />}
    <aside className={`studio-sidebar ${open ? 'is-open' : ''}`} aria-label="Workspace navigation">
      <div className="studio-brand-row"><Brand /><button className="studio-icon-button studio-mobile" onClick={() => setOpen(false)} aria-label="Close workspace navigation" data-testid="button-close-sidebar"><X size={20} /></button></div>
      <div className="studio-switcher"><span className="studio-avatar">{initials}</span><div><strong>Personal workspace</strong><span>Your corner of the internet</span></div></div>
      <p className="studio-nav-caption">Create & manage</p>
      <nav>{dashLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-sidebar-${label === 'Templates' ? 'template' : label.toLowerCase()}`} aria-current={location === href ? 'page' : undefined} className={`studio-nav-link ${location === href ? 'is-active' : ''}`}><Icon size={18} /><span>{label}</span>{location === href && <span className="studio-nav-dot" />}</Link>)}</nav>
      <div className="studio-sidebar-bottom"><div className="studio-sidebar-note"><Sparkles size={19} /><strong>Small details. Big first impression.</strong><p>Keep your latest work and contact details up to date.</p><Link href="/dashboard/content">Review your content <ArrowUpRight size={15} /></Link></div><Link href="/dashboard/settings" data-testid="link-sidebar-settings" className={`studio-nav-link ${location === '/dashboard/settings' ? 'is-active' : ''}`}><Settings size={18} />Settings</Link><div className="studio-account"><span className="studio-avatar">{initials}</span><div><strong>{name}</strong><span>Portfolio studio</span></div></div></div>
    </aside>
    <div className="studio-main"><header className="studio-topbar"><button className="studio-icon-button studio-mobile" onClick={() => setOpen(true)} aria-label="Open workspace navigation" aria-expanded={open} data-testid="button-open-sidebar"><Menu size={21} /></button><div className="studio-breadcrumb">Workspace <ChevronRight size={14} /><strong>{dashLinks.find(item => item.href === location)?.label || 'Settings'}</strong></div><div className="studio-topbar-actions">{portfolio?.status === 'published' && <a href={portfolioUrl(portfolio.slug)} target="_blank" rel="noopener noreferrer" data-testid="link-view-live" className="studio-subtle-link">View live site <ExternalLink size={15} /></a>}<span className="studio-avatar">{initials}</span></div></header><main id="workspace-main" className="studio-page" tabIndex={-1}>{children}</main></div>
  </div>;
}

function PortfolioState({ children }: { children: (portfolio: any) => ReactNode }) {
  const { portfolio, isLoading, isError, refetch } = usePortfolioData();
  if (isLoading) return <div className="studio-loading" role="status"><Loader2 className="animate-spin" size={24} /><p>Opening your workspace…</p></div>;
  if (isError) return <div className="studio-empty"><span className="studio-empty-icon"><Globe2 /></span><h1>Your workspace couldn’t load</h1><p>Your portfolio hasn’t been changed. Check your connection and try again.</p><Button onClick={() => void refetch()}>Try again</Button></div>;
  if (!portfolio) return <div className="studio-empty"><span className="studio-empty-icon"><Sparkles /></span><span className="studio-tag">A fresh start</span><h1>A place for everything<br />you’re proud of.</h1><p>Introduce yourself, choose a design, and make a portfolio that feels like you.</p><Link href="/onboarding/upload" className="studio-primary-link" data-testid="link-create-first-portfolio">Create your portfolio <ArrowRight size={17} /></Link><div className="studio-empty-steps"><span><FileText size={18} />Add your story</span><span><Layers3 size={18} />Pick your design</span><span><Globe2 size={18} />Get your link</span></div></div>;
  return <>{children(portfolio)}</>;
}

export function DashboardHome() {
  return <DashboardShell><PortfolioState>{portfolio => <OverviewContent portfolio={portfolio} />}</PortfolioState></DashboardShell>;
}

function OverviewContent({ portfolio }: any) {
  const c = portfolio.content || blankContent;
  const name = c.personalInfo?.name?.split(' ')[0] || 'there';
  const reduced = useReducedMotion();
  const checks = [
    { title: 'Introduce yourself', text: 'Your name, headline, and a short bio', complete: Boolean(c.personalInfo?.name && c.personalInfo?.headline && c.personalInfo?.summary), href: '/dashboard/content' },
    { title: 'Show what you do', text: 'Add experience or a project you’re proud of', complete: Boolean(c.projects?.length || c.experience?.length), href: '/dashboard/content' },
    { title: 'Make it easy to connect', text: 'Add an email or social link', complete: Boolean(c.personalInfo?.email || Object.values(c.socialLinks || {}).some(Boolean)), href: '/dashboard/content' },
    { title: 'Publish your portfolio', text: 'Put your personal link out into the world', complete: portfolio.status === 'published', href: '/dashboard/portfolio' },
  ];
  const completed = checks.filter(item => item.complete).length;
  return <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .28 }}>
    <div className="studio-page-heading"><div><p className="studio-kicker">Let’s make an impression</p><h1>Welcome back, {name}<span className="studio-greeting-dot">.</span></h1><p>Your work deserves a great home. Make it yours.</p></div><Link href="/dashboard/content" className="studio-primary-link" data-testid="link-dashboard-edit"><Pencil size={16} />Edit portfolio</Link></div>
    <div className="studio-overview-grid"><section className="studio-card studio-preview-card"><div className="studio-card-heading"><div><h2>Your portfolio</h2><p>A little preview of your next big opportunity.</p></div><Status published={portfolio.status === 'published'} /></div><BrowserPreview portfolio={portfolio} /><div className="studio-preview-footer"><div><Globe2 size={16} /><span>{portfolioUrl(portfolio.slug).replace(/^https?:\/\//, '')}</span></div><Link href="/dashboard/portfolio" data-testid="link-dashboard-portfolio">Manage site <ArrowUpRight size={17} /></Link></div></section>
    <aside className="studio-progress-card"><div className="studio-card-heading"><h2>Make it complete</h2><span className="studio-tag">{completed} of 4</span></div><p className="studio-description">A few thoughtful details go a long way.</p><div className="studio-progress-track" role="progressbar" aria-label="Portfolio completeness" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={4}><motion.span initial={false} animate={{ width: `${completed * 25}%` }} transition={{ duration: reduced ? 0 : .6 }} /></div><div className="studio-checklist">{checks.map((item, index) => <Link href={item.href} key={item.title}><span className={`studio-check ${item.complete ? 'is-done' : ''}`}>{item.complete ? <Check size={14} /> : index + 1}</span><div><strong>{item.title}</strong><span>{item.text}</span></div><ChevronRight size={16} /></Link>)}</div><div className="studio-tip"><Sparkles size={18} /><p><strong>A small tip</strong> Write your headline for the opportunity you want next.</p></div></aside></div>
    <div className="studio-overview-bottom"><StatCard label="Portfolio views" value={Number(portfolio.views || 0).toLocaleString()} change="Total page loads since publication" /><StatCard label="Last saved" value={portfolio.updatedAt ? new Date(portfolio.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Not saved'} change="Your most recent portfolio update" /><Link className="studio-design-nudge" href="/dashboard/templates" data-testid="link-dashboard-note"><span className="studio-empty-icon"><Layers3 size={21} /></span><div><h2>Same you. A fresh look.</h2><p>Explore a new design for your story.</p></div><ArrowUpRight size={21} /></Link></div>
  </motion.div>;
}

export function Status({ published }: { published: boolean }) {
  return <span className={`studio-status ${published ? 'is-live' : ''}`}><span />{published ? 'Published' : 'Draft'}</span>;
}

export function StatCard({ label, value, change }: any) {
  return <div className="studio-stat"><p>{label}</p><strong>{value}</strong><span>{change}</span></div>;
}

export function DashboardPage({ section }: { section: string }) {
  return <DashboardShell><PortfolioState>{portfolio => <DashboardSection section={section} portfolio={portfolio} />}</PortfolioState></DashboardShell>;
}

function DashboardSection({ section, portfolio }: any) {
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('Profile');
  const [editedContent, setEditedContent] = useState<any>(null);
  const [validation, setValidation] = useState('');
  const update = useUpdatePortfolio();
  const content = editedContent || portfolio.content || blankContent;
  const titles: Record<string, [string, string]> = { portfolio: ['Your portfolio, ready to share.', 'Manage your public link and decide when your work goes live.'], content: ['Tell your story.', 'The good work, the big ideas, and the details that make you, you.'], templates: ['Find your kind of design.', 'A different perspective on your work. Your content stays with you.'], appearance: ['Make it feel like you.', 'Your chosen template sets the visual direction for your portfolio.'], domain: ['A link to call your own.', 'Your portfolio already has a home. Here’s how to share it.'], analytics: ['See your reach.', 'A simple look at visits to your published portfolio.'], billing: ['Plan and billing.', 'Keep track of the services available in your workspace.'], settings: ['Your workspace settings.', 'Manage what visitors see and keep your information up to date.'] };
  const [title, subtitle] = titles[section] || titles.settings;
  const save = () => {
    if (!content.personalInfo?.name?.trim()) { setValidation('Add your name before saving your portfolio.'); return; }
    setValidation('');
    update.mutate({ id: portfolio.id, data: { content } }, { onSuccess: result => { updateCache(result); setEditedContent(null); setSaved(true); } });
  };
  useEffect(() => {
    if (!editedContent) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editedContent]);
  const edit = (next: any) => { setEditedContent(next); setSaved(false); update.reset(); };
  return <><div className="studio-page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{section === 'content' && <Button onClick={save} disabled={update.isPending || (!editedContent && !saved)} data-testid="button-save-changes">{update.isPending ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Check size={16} />}{update.isPending ? 'Saving…' : saved ? 'Changes saved' : 'Save changes'}</Button>}</div>{(validation || update.isError) && <Feedback>{validation || 'Your changes couldn’t be saved. Try again; your edits are still here.'}</Feedback>}{section === 'content' ? <><div className="studio-save-note" role="status">{editedContent ? 'You have unsaved changes.' : saved ? 'Your latest changes are saved.' : 'Edits appear on your published site after you save.'}</div><ContentEditor content={content} setContent={edit} tab={tab} setTab={setTab} /></> : section === 'templates' ? <TemplatesPanel selected={portfolio.templateId} portfolio={portfolio} /> : section === 'appearance' ? <AppearancePanel portfolio={portfolio} /> : section === 'analytics' ? <AnalyticsPanel portfolio={portfolio} /> : section === 'domain' ? <DomainPanel slug={portfolio.slug} published={portfolio.status === 'published'} /> : section === 'portfolio' ? <PortfolioPanel portfolio={portfolio} /> : <GenericPanel section={section} portfolio={portfolio} />}</>;
}

const newId = () => crypto.randomUUID();

export function ContentEditor({ content, setContent, tab, setTab }: any) {
  const [skill, setSkill] = useState('');
  const tabs = ['Profile', 'Experience', 'Projects', 'Skills', 'Education', 'Links'];
  const c = { ...blankContent, ...content, personalInfo: { ...blankContent.personalInfo, ...content.personalInfo }, socialLinks: { ...blankContent.socialLinks, ...content.socialLinks } };
  const updatePersonal = (field: string, value: string) => setContent({ ...c, personalInfo: { ...c.personalInfo, [field]: value } });
  const updateItem = (list: string, id: string, field: string, value: any) => setContent({ ...c, [list]: c[list].map((item: any) => item.id === id ? { ...item, [field]: value } : item) });
  const removeItem = (list: string, id: string) => setContent({ ...c, [list]: c[list].filter((item: any) => item.id !== id) });
  const addSkill = () => { if (skill.trim() && !c.skills.includes(skill.trim())) setContent({ ...c, skills: [...c.skills, skill.trim()] }); setSkill(''); };
  return <div className="studio-editor"><div className="studio-editor-nav" role="tablist" aria-label="Content sections">{tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} aria-controls={`content-${t}`} id={`tab-${t}`} onClick={() => setTab(t)} className={tab === t ? 'is-active' : ''} data-testid={`button-content-tab-${t.toLowerCase()}`}>{t}{tab === t && <ChevronRight size={15} />}</button>)}</div><div className="studio-card studio-editor-body" role="tabpanel" id={`content-${tab}`} aria-labelledby={`tab-${tab}`}>
    {tab === 'Profile' && <><SectionHeading label="The introduction" title="Start with you." /><p className="studio-description">Give visitors a clear picture of who you are and what you do.</p><div className="studio-form-grid"><Field label="Name" value={c.personalInfo.name} onChange={(v: string) => updatePersonal('name', v)} placeholder="Your full name" /><Field label="Headline" value={c.personalInfo.headline} onChange={(v: string) => updatePersonal('headline', v)} placeholder="What you do, in one line" /><Field label="Email" value={c.personalInfo.email} onChange={(v: string) => updatePersonal('email', v)} placeholder="hello@example.com" type="email" /><Field label="Phone" value={c.personalInfo.phone} onChange={(v: string) => updatePersonal('phone', v)} placeholder="Optional public contact number" type="tel" /><Field label="Location" value={c.personalInfo.location} onChange={(v: string) => updatePersonal('location', v)} placeholder="City, country" /><Field label="Photo URL" value={c.personalInfo.avatar || ''} onChange={(v: string) => updatePersonal('avatar', v)} placeholder="https://… (optional)" /></div><Field label="Summary" value={c.personalInfo.summary} onChange={(v: string) => updatePersonal('summary', v)} area placeholder="Share a little about your work, your interests, and what you’re looking for next." /><p className="studio-field-help"><ShieldCheck size={14} /> Contact details you add here appear on your published portfolio.</p></>}
    {tab === 'Experience' && <><SectionHeading label="Your journey" title="Experience that tells a story." /><p className="studio-description">Include the roles, responsibilities, and work that matter to you.</p>{c.experience.length === 0 && <InlineEmpty text="No experience added yet. Add a role, internship, or volunteer position." />}<div className="studio-edit-list">{c.experience.map((item: any, i: number) => <div className="studio-edit-item" key={item.id}><div className="studio-edit-item-heading"><strong>Experience {i + 1}</strong><button className="studio-icon-button" aria-label={`Remove experience ${i + 1}`} onClick={() => removeItem('experience', item.id)}><Trash2 size={16} /></button></div><div className="studio-form-grid"><Field label="Role" value={item.role} onChange={(v: string) => updateItem('experience', item.id, 'role', v)} /><Field label="Company" value={item.company} onChange={(v: string) => updateItem('experience', item.id, 'company', v)} /><Field label="Period" value={item.period} onChange={(v: string) => updateItem('experience', item.id, 'period', v)} placeholder="2023 — Present" /></div><Field label="Description" value={item.description} onChange={(v: string) => updateItem('experience', item.id, 'description', v)} area /></div>)}</div><Button variant="outline" onClick={() => setContent({ ...c, experience: [...c.experience, { id: newId(), role: '', company: '', period: '', description: '' }] })} data-testid="button-add-experience"><Plus size={16} />Add experience</Button></>}
    {tab === 'Projects' && <><SectionHeading label="Selected work" title="Let your work do the talking." /><p className="studio-description">Give each project context and a link people can explore.</p>{c.projects.length === 0 && <InlineEmpty text="What have you made, led, or helped bring to life? Add your first project." />}<div className="studio-edit-list">{c.projects.map((item: any, i: number) => <div className="studio-edit-item" key={item.id}><div className="studio-edit-item-heading"><strong>Project {i + 1}</strong><button className="studio-icon-button" aria-label={`Remove project ${i + 1}`} onClick={() => removeItem('projects', item.id)}><Trash2 size={16} /></button></div><Field label="Project name" value={item.name} onChange={(v: string) => updateItem('projects', item.id, 'name', v)} /><Field label="Description" value={item.description} onChange={(v: string) => updateItem('projects', item.id, 'description', v)} area /><div className="studio-form-grid"><Field label="Live link" value={item.liveUrl} onChange={(v: string) => updateItem('projects', item.id, 'liveUrl', v)} placeholder="https://…" /><Field label="GitHub link" value={item.githubUrl} onChange={(v: string) => updateItem('projects', item.id, 'githubUrl', v)} placeholder="https://github.com/…" /><Field label="Tools or skills" value={item.technologies.join(', ')} onChange={(v: string) => updateItem('projects', item.id, 'technologies', v.split(',').map(x => x.trim()))} placeholder="Research, Figma, Prototyping" /><Field label="Image URL" value={item.image || ''} onChange={(v: string) => updateItem('projects', item.id, 'image', v)} placeholder="https://… (optional)" /></div></div>)}</div><Button variant="outline" onClick={() => setContent({ ...c, projects: [...c.projects, { id: newId(), name: '', description: '', technologies: [], githubUrl: '', liveUrl: '', image: null }] })} data-testid="button-add-project"><Plus size={16} />Add project</Button></>}
    {tab === 'Skills' && <><SectionHeading label="Your toolkit" title="What you bring to the table." /><p className="studio-description">Include practical skills, tools, and subjects you know well.</p><form className="studio-skill-form" onSubmit={event => { event.preventDefault(); addSkill(); }}><label className="sr-only" htmlFor="new-skill">New skill</label><input id="new-skill" className="studio-input" value={skill} onChange={e => setSkill(e.target.value)} placeholder="For example, project management" maxLength={80} /><Button type="submit" variant="outline" disabled={!skill.trim()} data-testid="button-add-skill"><Plus size={16} />Add skill</Button></form><div className="studio-skill-list">{c.skills.map((item: string, i: number) => <span key={`${item}-${i}`}>{item}<button aria-label={`Remove ${item}`} onClick={() => setContent({ ...c, skills: c.skills.filter((_: string, index: number) => index !== i) })}><X size={13} /></button></span>)}</div>{c.skills.length === 0 && <InlineEmpty text="Your skills will appear here. Add your first one above." />}</>}
    {tab === 'Education' && <><SectionHeading label="Always learning" title="Where you built your foundation." />{c.education.length === 0 && <InlineEmpty text="Add a degree, course, or qualification you’d like to share." />}<div className="studio-edit-list">{c.education.map((item: any, i: number) => <div className="studio-edit-item" key={item.id}><div className="studio-edit-item-heading"><strong>Education {i + 1}</strong><button className="studio-icon-button" aria-label={`Remove education ${i + 1}`} onClick={() => removeItem('education', item.id)}><Trash2 size={16} /></button></div><div className="studio-form-grid"><Field label="School" value={item.school} onChange={(v: string) => updateItem('education', item.id, 'school', v)} /><Field label="Degree or course" value={item.degree} onChange={(v: string) => updateItem('education', item.id, 'degree', v)} /><Field label="Period" value={item.period} onChange={(v: string) => updateItem('education', item.id, 'period', v)} /></div></div>)}</div><Button variant="outline" onClick={() => setContent({ ...c, education: [...c.education, { id: newId(), school: '', degree: '', period: '' }] })}><Plus size={16} />Add education</Button></>}
    {tab === 'Links' && <><SectionHeading label="Keep the conversation going" title="A few more ways to find you." /><p className="studio-description">All links are optional. Only add profiles you want visitors to see.</p><div className="studio-form-grid">{['github', 'linkedin', 'twitter', 'website'].map(key => <Field key={key} label={{ github: 'GitHub', linkedin: 'LinkedIn', twitter: 'X / Twitter', website: 'Website' }[key]} value={c.socialLinks[key]} onChange={(v: string) => setContent({ ...c, socialLinks: { ...c.socialLinks, [key]: v } })} placeholder="https://…" />)}</div></>}
  </div></div>;
}

function InlineEmpty({ text }: { text: string }) { return <div className="studio-inline-empty">{text}</div>; }

export function SectionHeading({ label, title }: any) { return <div className="studio-section-heading">{label && <p>{label}</p>}<h2>{title}</h2></div>; }

export function Field({ label, value, onChange, area, placeholder, type = 'text' }: any) {
  return <label className={`studio-field ${area ? 'studio-field-area' : ''}`}><span>{label}</span>{area ? <textarea value={value || ''} onChange={event => onChange?.(event.target.value)} rows={4} className="studio-input" placeholder={placeholder} data-testid={`input-content-${label.toLowerCase()}`} /> : <input type={type} value={value || ''} onChange={event => onChange?.(event.target.value)} className="studio-input" placeholder={placeholder} data-testid={`input-content-${label.toLowerCase()}`} />}</label>;
}

export function BrowserPreview({ portfolio, controls = false }: any) {
  const [mobile, setMobile] = useState(false);
  return <div className={`studio-browser ${mobile ? 'is-mobile' : ''}`}><div className="studio-browser-toolbar"><span className="studio-browser-dots"><i /><i /><i /></span><span className="studio-browser-address"><Globe2 size={11} />{portfolio.slug ? `/p/${portfolio.slug}` : 'Your portfolio preview'}</span>{controls && <div className="studio-view-controls"><button aria-label="Desktop preview" aria-pressed={!mobile} onClick={() => setMobile(false)} className={!mobile ? 'is-active' : ''}><Monitor size={14} /></button><button aria-label="Mobile preview" aria-pressed={mobile} onClick={() => setMobile(true)} className={mobile ? 'is-active' : ''}><Smartphone size={14} /></button></div>}</div><div className="studio-browser-scroll"><PortfolioCanvas portfolio={portfolio} compact /></div></div>;
}

export function PortfolioPanel({ portfolio }: any) {
  const unpublish = useUnpublishPortfolio();
  const publish = usePublishPortfolio();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const live = portfolio.status === 'published';
  const copy = async () => { try { await navigator.clipboard.writeText(portfolioUrl(portfolio.slug)); setCopied(true); setCopyError(false); } catch { setCopyError(true); } };
  return <div className="studio-publish-grid"><section className="studio-card studio-preview-card"><div className="studio-card-heading"><h2>Your site preview</h2><Status published={live} /></div><BrowserPreview portfolio={portfolio} controls /><div className="studio-preview-footer"><span>Designed for every screen</span><Link href="/dashboard/content">Edit content <Pencil size={14} /></Link></div></section><aside className="studio-publish-side"><div className="studio-card studio-card-pad"><span className="studio-empty-icon"><Globe2 size={22} /></span><h2>{live ? 'Hello, world.' : 'Ready when you are.'}</h2><p className="studio-description">{live ? 'Your portfolio is published. Share your link wherever opportunities find you.' : 'Publish your portfolio to make this link accessible to everyone.'}</p><label className="studio-field"><span>Your portfolio link</span><input className="studio-input studio-url" value={portfolioUrl(portfolio.slug)} readOnly onFocus={event => event.target.select()} /></label><div className="studio-publish-actions">{live ? <><Button variant="outline" onClick={copy} data-testid="button-copy-link">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Link copied' : 'Copy link'}</Button><a href={portfolioUrl(portfolio.slug)} target="_blank" rel="noopener noreferrer" data-testid="link-open-portfolio" className="studio-primary-link">Open portfolio <ExternalLink size={16} /></a></> : <Button onClick={() => publish.mutate({ id: portfolio.id }, { onSuccess: updateCache })} disabled={publish.isPending || !portfolio.content?.personalInfo?.name?.trim()} data-testid="button-publish-portfolio">{publish.isPending ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />}Publish portfolio</Button>}</div>{copyError && <Feedback>Copy wasn’t available. Select the link above and copy it manually.</Feedback>}{(publish.isError || unpublish.isError) && <Feedback>Your publishing status couldn’t be changed. Please try again.</Feedback>}{live && <div className="studio-unpublish">{confirmUnpublish ? <><p>Hide your portfolio from visitors? Your content will stay saved.</p><div><Button variant="outline" onClick={() => setConfirmUnpublish(false)}>Keep published</Button><Button variant="ghost" disabled={unpublish.isPending} onClick={() => unpublish.mutate({ id: portfolio.id }, { onSuccess: result => { updateCache(result); setConfirmUnpublish(false); } })}>{unpublish.isPending ? 'Unpublishing…' : 'Yes, unpublish'}</Button></div></> : <button onClick={() => setConfirmUnpublish(true)} data-testid="button-unpublish">Unpublish portfolio</button>}</div>}</div><Link href="/dashboard/domain" className="studio-domain-nudge" data-testid="link-portfolio-domain"><Link2 size={20} /><div><strong>Have a domain in mind?</strong><span>Explore your portfolio address</span></div><ArrowUpRight size={17} /></Link></aside></div>;
}

export function TemplatesPanel({ selected, portfolio }: any) {
  const { data, isLoading, isError, refetch } = useListTemplates({ query: { queryKey: getListTemplatesQueryKey() } });
  const update = useUpdatePortfolio();
  const choose = (template: any) => { if (!update.isPending && template.id !== selected) update.mutate({ id: portfolio.id, data: { templateId: template.id } }, { onSuccess: updateCache }); };
  if (isLoading) return <div className="studio-loading" role="status"><Loader2 className="animate-spin" />Loading your design options…</div>;
  if (isError) return <div className="studio-card studio-card-pad"><Feedback>Templates couldn’t load. Your current design is unchanged.</Feedback><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div>;
  return <>{update.isError && <Feedback>Your template couldn’t be changed. Try again.</Feedback>}{update.isPending && <p className="studio-save-note" role="status">Applying your design…</p>}{update.isSuccess && <Feedback success>Your new design is saved.</Feedback>}<div className="studio-template-grid" aria-busy={update.isPending}>{data?.map(template => <TemplateCard key={template.id} template={template} selected={selected === template.id} onChoose={choose} />)}</div>{!data?.length && <InlineEmpty text="No templates are available yet. Check back once designs are added." />}</>;
}

export function AppearancePanel({ portfolio }: any) {
  return <div className="studio-publish-grid"><div className="studio-card studio-card-pad"><SectionHeading label="Your visual identity" title="A design that works together." /><p className="studio-description">Your template includes a coordinated color palette, typography, and responsive layout.</p><div className="studio-appearance-feature"><Palette size={20} /><div><strong>A considered color palette</strong><p>Colors chosen to keep your content readable.</p></div></div><div className="studio-appearance-feature"><Monitor size={20} /><div><strong>Looks good on every screen</strong><p>A layout that adapts from desktop to mobile.</p></div></div><Link href="/dashboard/templates" className="studio-primary-link">Change template <ArrowRight size={16} /></Link><p className="studio-field-help">Custom color and font editing isn’t available yet.</p></div><div className="studio-card studio-preview-card"><div className="studio-card-heading"><h2>Your current design</h2></div><BrowserPreview portfolio={portfolio} controls /></div></div>;
}

export function AnalyticsPanel({ portfolio }: any) {
  return <div className="studio-analytics"><StatCard label="Total portfolio views" value={Number(portfolio?.views || 0).toLocaleString()} change="Page loads, including repeat visits and your own visits" /><div className="studio-card studio-card-pad"><span className="studio-empty-icon"><BarChart3 /></span><h2>Every visit starts with a link.</h2><p className="studio-description">{portfolio?.status === 'published' ? 'Add your portfolio to your LinkedIn profile, applications, and email signature to help people discover your work.' : 'Publish your portfolio first, then share your link to start receiving visitors.'}</p><Link href="/dashboard/portfolio" className="studio-primary-link">{portfolio?.status === 'published' ? 'Get your portfolio link' : 'Publish your portfolio'}<ArrowRight size={16} /></Link><p className="studio-field-help">Visitor trends and referral reports aren’t available yet.</p></div></div>;
}

export function DomainPanel({ slug, published = false }: any) {
  return <div className="studio-domain-grid"><div className="studio-card studio-card-pad"><span className="studio-empty-icon"><Globe2 /></span><h2>Your included portfolio address</h2><p className="studio-description">One link for your work, your story, and your next opportunity.</p><label className="studio-field"><span>Your current address</span><input className="studio-input studio-url" readOnly value={portfolioUrl(slug)} onFocus={e => e.target.select()} /></label><div className="studio-domain-status"><Status published={published} /><span>{published ? 'Your link is accessible to everyone.' : 'Publish your portfolio to activate your link.'}</span></div><Link href="/dashboard/portfolio" className="studio-subtle-link">Manage your public link <ArrowRight size={15} /></Link></div><div className="studio-card studio-card-pad"><span className="studio-tag">Coming later</span><h2>Make the address yours.</h2><p className="studio-description">Connecting a domain you own and buying a new domain will be available in a future release.</p><div className="studio-domain-example"><Link2 size={18} /><span>yourname.com</span></div><p className="studio-field-help">Domain setup isn’t available in this version. You can use your included portfolio link now.</p></div></div>;
}

export function GenericPanel({ section, portfolio }: any) {
  return <div className="studio-card studio-card-pad studio-settings"><SectionHeading title={section === 'billing' ? 'No billing is connected yet.' : 'Your public profile'} label={section === 'billing' ? 'Plan & billing' : 'Workspace settings'} /><p className="studio-description">{section === 'billing' ? 'Payments and subscriptions will be available in a future release. This workspace cannot charge you.' : 'Your profile details and links are managed in the content editor. Only published portfolios are visible to visitors.'}</p>{section !== 'billing' && <><div className="studio-settings-row"><span>Portfolio visibility</span><Status published={portfolio?.status === 'published'} /></div><Link href="/dashboard/content" className="studio-primary-link">Edit profile details <Pencil size={16} /></Link><Link href="/dashboard/portfolio" className="studio-subtle-link">Manage publication <ArrowRight size={15} /></Link></>}</div>;
}

export function PortfolioCanvas({ portfolio, compact = false }: any) {
  const c = { ...blankContent, ...portfolio?.content, personalInfo: { ...blankContent.personalInfo, ...portfolio?.content?.personalInfo }, socialLinks: { ...blankContent.socialLinks, ...portfolio?.content?.socialLinks } };
  const template = portfolio?.templateId === 'developer-command-center' ? 'developer' : portfolio?.templateId === 'bento-professional' ? 'bento' : 'clean';
  const projects = (c.projects || []).filter((item: any) => item.name?.trim());
  const experiences = (c.experience || []).filter((item: any) => item.role?.trim() || item.company?.trim());
  const education = (c.education || []).filter((item: any) => item.degree?.trim() || item.school?.trim());
  const socials = Object.entries(c.socialLinks || {}).filter(([, value]) => safeUrl(value as string));
  const avatar = safeUrl(c.personalInfo.avatar);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.personalInfo.email || '') ? c.personalInfo.email : '';
  return <div className={`portfolio-canvas portfolio-${template} ${compact ? 'portfolio-compact' : ''}`}>
    <div className="portfolio-canvas-inner"><header className="portfolio-header"><a href="#intro" className="portfolio-monogram">{template === 'developer' && <Code2 size={19} />}{c.personalInfo.name || (compact ? 'Your name' : 'Portfolio')}<span /></a><nav aria-label="Portfolio sections">{projects.length > 0 && <a href="#work">Work</a>}{experiences.length > 0 && <a href="#experience">Experience</a>}{(email || socials.length > 0) && <a href="#contact">Contact <ArrowUpRight size={13} /></a>}</nav></header>
    <section id="intro" className="portfolio-hero"><div className="portfolio-introduction">{template === 'developer' && <p className="portfolio-terminal-label"><span>›</span> hello, world</p>}<p className="portfolio-eyebrow">{portfolio?.profession || 'A personal introduction'}</p><h1>{c.personalInfo.name || (compact ? 'Your name goes here.' : 'Welcome.')}</h1>{(c.personalInfo.headline || compact) && <h2>{c.personalInfo.headline || 'A few words about what you do.'}</h2>}{c.personalInfo.summary && <p className="portfolio-summary">{c.personalInfo.summary}</p>}<div className="portfolio-intro-details">{c.personalInfo.location && <span><MapPin size={14} />{c.personalInfo.location}</span>}{email && <a href={`mailto:${email}`}><Mail size={14} />Get in touch <ArrowUpRight size={13} /></a>}</div></div><div className="portfolio-hero-aside">{avatar ? <img className="portfolio-avatar" src={avatar} alt={c.personalInfo.name} loading="lazy" referrerPolicy="no-referrer" /> : template === 'developer' ? <div className="portfolio-code-panel"><div><span /><span /><span /></div><p><span>const</span> profile = {'{'}</p><p>&nbsp; name: <em>"{c.personalInfo.name || 'Your name'}"</em>,</p><p>&nbsp; focus: <em>"{portfolio?.profession || 'My work'}"</em>,</p><p>&nbsp; skills: <em>{c.skills?.length || 0}</em></p><p>{'}'};</p><p className="portfolio-code-comment">// always building, always learning</p></div> : <div className="portfolio-initial-art" aria-hidden="true"><span>{c.personalInfo.name?.split(' ').map((word: string) => word[0]).slice(0, 2).join('') || 'You'}</span><i /><b /></div>}{template === 'bento' && c.skills?.length > 0 && <div className="portfolio-aside-skills"><p>What I work with</p><div>{c.skills.slice(0, 6).map((skill: string, i: number) => <span key={`${skill}-${i}`}>{skill}</span>)}</div></div>}</div></section>
    {projects.length > 0 && <section id="work" className="portfolio-section"><div className="portfolio-section-title"><h2>Selected work</h2><span>{String(projects.length).padStart(2, '0')} projects</span></div><div className="portfolio-project-grid">{projects.map((project: any, index: number) => <article className="portfolio-project" key={project.id || index}>{safeUrl(project.image) ? <img className="portfolio-project-image" src={safeUrl(project.image)} alt={project.name} loading="lazy" referrerPolicy="no-referrer" /> : <div className="portfolio-project-graphic" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><div>{template === 'developer' ? <Code2 size={45} strokeWidth={1} /> : <Layers3 size={45} strokeWidth={1} />}</div></div>}<div className="portfolio-project-copy"><h3>{project.name}</h3>{project.description && <p>{project.description}</p>}<div className="portfolio-tags">{project.technologies?.filter(Boolean).map((technology: string, i: number) => <span key={`${technology}-${i}`}>{technology}</span>)}</div><div className="portfolio-project-links">{safeUrl(project.liveUrl) && <a href={safeUrl(project.liveUrl)} target="_blank" rel="noopener noreferrer">Explore project <ArrowUpRight size={14} /></a>}{safeUrl(project.githubUrl) && <a href={safeUrl(project.githubUrl)} target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={14} /></a>}</div></div></article>)}</div></section>}
    <div className="portfolio-record-grid">{experiences.length > 0 && <section id="experience" className="portfolio-section"><div className="portfolio-section-title"><h2>Experience</h2></div><div className="portfolio-timeline">{experiences.map((item: any, index: number) => <article key={item.id || index}><span className="portfolio-timeline-dot" /><p className="portfolio-period">{item.period}</p><h3>{item.role}</h3><strong>{item.company}</strong>{item.description && <p>{item.description}</p>}</article>)}</div></section>}{education.length > 0 && <section className="portfolio-section"><div className="portfolio-section-title"><h2>Education</h2></div><div className="portfolio-timeline">{education.map((item: any, index: number) => <article key={item.id || index}><span className="portfolio-timeline-dot" /><p className="portfolio-period">{item.period}</p><h3>{item.degree}</h3><strong>{item.school}</strong></article>)}</div></section>}</div>
    {c.skills?.length > 0 && <section className="portfolio-section"><div className="portfolio-section-title"><h2>Skills & expertise</h2></div><div className="portfolio-skill-cloud">{c.skills.map((skill: string, index: number) => <span key={`${skill}-${index}`}>{skill}</span>)}</div></section>}
    {(email || socials.length > 0 || c.personalInfo.phone) && <section id="contact" className="portfolio-contact"><div><p>Have something in mind?</p><h2>Let’s connect.</h2></div><div className="portfolio-contact-links">{email && <a href={`mailto:${email}`} data-testid="link-public-email">{email} <ArrowUpRight size={17} /></a>}{c.personalInfo.phone && <a href={`tel:${c.personalInfo.phone.replace(/[^\d+]/g, '')}`}>{c.personalInfo.phone}</a>}<div>{socials.map(([key, value]) => <a key={key} href={safeUrl(value as string)} target="_blank" rel="noopener noreferrer" data-testid={`link-public-${key}`}>{{ github: 'GitHub', linkedin: 'LinkedIn', twitter: 'X / Twitter', website: 'Website' }[key] || key}<ArrowUpRight size={14} /></a>)}</div></div></section>}
    <footer className="portfolio-footer"><span>{c.personalInfo.name || 'Portfolio'}{c.personalInfo.name && ` © ${new Date().getFullYear()}`}</span><Link href="/">Made with Folio <ArrowUpRight size={12} /></Link></footer></div>
  </div>;
}

export function PublicPortfolio() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useGetPublicPortfolio(slug, { query: { queryKey: getGetPublicPortfolioQueryKey(slug), retry: false, refetchOnWindowFocus: false } });
  useEffect(() => { const previous = document.title; if (data?.content?.personalInfo?.name) document.title = `${data.content.personalInfo.name} | Portfolio`; return () => { document.title = previous; }; }, [data]);
  if (isLoading) return <div className="studio-loading studio-public-state" role="status"><Loader2 className="animate-spin" /><p>Opening this portfolio…</p></div>;
  if (isError || !data) return <div className="studio-empty studio-public-state"><span className="studio-empty-icon"><Globe2 /></span><h1>This portfolio isn’t available.</h1><p>The link may have changed, or the owner may have unpublished it.</p><Link href="/" className="studio-primary-link" data-testid="link-public-home">Back to Folio <ArrowRight size={16} /></Link></div>;
  return <main><PortfolioCanvas portfolio={data} /></main>;
}
