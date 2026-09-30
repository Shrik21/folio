import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, Eye, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PortfolioMini } from '@/components/portfolio-mini';
import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' };
export function Button({ children, variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} {...props} className={cn('folio-button', `folio-button-${variant}`, className)}>{children}</button>;
}
export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" data-testid="link-brand" aria-label="Folio home" className={cn('folio-brand',light && 'folio-brand-light')}><span className="folio-brand-mark" aria-hidden="true"><i /><i /></span>folio<span className="text-primary">.</span></Link>;
}
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if(e.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown',close); return () => window.removeEventListener('keydown',close);
  }, [open]);
  const links: ReactNode = <><Link href="/templates" aria-current={location === '/templates' ? 'page' : undefined} data-testid="link-nav-templates">Templates</Link><a href="/#how-it-works" onClick={() => setOpen(false)} data-testid="link-nav-story">How it works</a><Link href="/pricing" aria-current={location === '/pricing' ? 'page' : undefined} data-testid="link-nav-pricing">Pricing</Link></>;
  return <header className="site-nav"><div className="site-nav-inner"><Brand /><nav className="site-nav-links" aria-label="Main navigation">{links}</nav><div className="site-nav-actions"><Link href="/login" className="folio-button folio-button-ghost site-nav-signin" data-testid="link-nav-login">Sign in</Link><Link href="/onboarding/upload" className="folio-button folio-button-primary" data-testid="link-nav-signup">Build my portfolio <ArrowRight size={15}/></Link><button ref={menuButton} className="site-nav-mobile-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-navigation" data-testid="button-mobile-menu">{open ? <X size={21}/> : <Menu size={21}/>}</button></div></div><AnimatePresence>{open && <motion.nav id="mobile-navigation" className="site-nav-mobile" aria-label="Mobile navigation" initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0}} data-testid="nav-mobile">{links}<Link href="/login">Sign in</Link></motion.nav>}</AnimatePresence></header>;
}
export function Footer() {
  return <footer className="site-footer"><div className="site-footer-inner"><div><Brand/><p>Your experience. Your space on the internet.</p></div><nav className="site-footer-links" aria-label="Footer"><Link href="/templates">Templates</Link><Link href="/pricing">Pricing</Link><Link href="/login">Your account</Link><span>© {new Date().getFullYear()} Folio</span></nav></div></footer>;
}
export function InfoBlock({ n, title, text }: { n: string; title: string; text: string }) { return <div><span className="text-sm text-primary">{n}</span><h3 className="mt-4 font-display text-xl">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></div>; }
export type Template = { id: string; name: string; description: string; premium: boolean; category?: string; layout?: string; accent?: string; recommendedFor?: string[] };
export function TemplateCard({ template, onChoose, selected }: { template: Template; onChoose?: (template: Template) => void; selected?: boolean }) {
  const [preview, setPreview] = useState(false);
  return <article className={cn('template-card',selected && 'template-card-selected')} data-testid={`card-template-${template.id}`}>
    <div className={`template-card-stage stage-${template.layout || 'timeline'}`}><div className="template-card-browser"><div className="mini-browser-bar"><i/><i/><i/><span>your-portfolio</span></div><PortfolioMini templateId={template.id}/></div><button className="template-preview-trigger" onClick={() => setPreview(true)} aria-label={`Preview ${template.name}`} data-testid={`button-preview-template-${template.id}`}><Eye size={16}/> Preview design</button></div>
    <div className="template-card-body"><div className="template-card-heading"><h3>{template.name}</h3><span className={template.premium ? 'premium-badge' : 'free-badge'}>{template.premium ? 'Premium' : 'Free'}</span></div><p>{template.description}</p><div className="template-card-bottom"><span>{template.category || 'All professions'}</span><Button variant={selected ? 'primary' : 'outline'} onClick={() => onChoose?.(template)} data-testid={`button-choose-template-${template.id}`}>{selected ? <><Check size={14}/> Selected</> : <>Choose design <ArrowRight size={14}/></>}</Button></div></div>
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-w-[820px] rounded-2xl p-0 w-[calc(100%-24px)]"><div className="px-6 pt-6"><DialogTitle>{template.name}</DialogTitle><DialogDescription className="mt-2">Sample portfolio · {template.premium ? 'Premium design — preview for free' : 'Free to publish'}</DialogDescription></div><div className="px-4"><PortfolioMini templateId={template.id} expanded/></div><div className="sticky bottom-0 flex items-center justify-between gap-4 border-t bg-white px-6 py-4"><span className="text-sm text-muted-foreground">Make this design yours.</span><Button onClick={() => { onChoose?.(template); setPreview(false); }}>Choose this design <ArrowRight size={15}/></Button></div></DialogContent></Dialog>
  </article>;
}
