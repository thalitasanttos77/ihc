import { Router } from '@angular/router';
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Renderer2, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit, OnDestroy {

  @ViewChild('exploreRow', { static: false }) exploreRow!: ElementRef<HTMLElement>;
  @ViewChild('sidebar', { static: false }) sidebarEl!: ElementRef<HTMLElement>;
  @ViewChild('menuBtn', { static: false }) menuBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('newsModal', { static: false }) newsModalEl!: ElementRef<HTMLElement>;

  isSidebarOpen = false;
  private autoplayIntervalId: any = null;
  private autoplayDelay = 3000; // ms
  private tilesToScroll = 1;
  private isPaused = false;

  // modal state
  isNewsModalOpen = false;
  selectedNews: any = null;
  private lastFocusedBeforeModal: HTMLElement | null = null;

  // counter to avoid rapid pause/resume when moving between child elements
  private hoverCounter = 0;

  // references to renderer listeners so we can remove them on destroy if needed
  private unlistenPointerEnter: (() => void) | null = null;
  private unlistenPointerLeave: (() => void) | null = null;
  private unlistenFocusIn: (() => void) | null = null;
  private unlistenFocusOut: (() => void) | null = null;

  // sample news list (move to service if prefer)
  newsList = [
    {
      id: 'vestibular-2026',
      title: 'Vestibular 2026',
      img: 'img/estudantes.png',
      alt: 'vestibular 2026',
      excerpt: 'Fique por dentro das datas de inscrição, isenção, provas e da divulgação do edital oficial.',
      content: 'Informações completas sobre o Vestibular 2026: prazos, etapas e orientações para candidatos...',
      keywords: 'vestibular 2026'
    },
    {
      id: 'evento-tech',
      title: 'Evento Tech',
      img: 'img/evento.jpg',
      alt: 'Evento TECH',
      excerpt: 'Garanta sua vaga no maior evento de tecnologia, com palestras, workshops e networking com profissionais da área.',
      content: 'O Evento Tech contará com palestrantes nacionais e internacionais, programação intensa de workshops...',
      keywords: 'Evento TECH'
    },
    {
      id: 'projetos-extensao',
      title: 'Projetos de Extensão',
      img: 'img/estudantes-rindo.png',
      alt: 'projetos de extensão',
      excerpt: 'Descubra como aplicar seus conhecimentos acadêmicos em projetos práticos.',
      content: 'Os projetos de extensão oferecem oportunidades de aplicar conhecimentos acadêmicos em ações sociais...',
      keywords: 'projetos extensão'
    },
    {
      id: 'formandos-2026-1',
      title: 'Formandos 2026.1',
      img: 'img/formandos.jpg',
      alt: 'Formandos 2026.1',
      excerpt: 'Descubra como se preparar para a formatura e os eventos relacionados.',
      content: 'Informações sobre cerimônias, ensaios e retirada de becas para formandos 2026.1...',
      keywords: 'formatura formandos 2026'
    }
  ];

  constructor(private renderer: Renderer2, private router: Router) {}

    openNews(id: string | undefined) {
    if (!id) return;
    // navega para a rota da notícia completa (se existir)
    this.closeNewsModal();
    this.router.navigate(['/news', id]);
  }


  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      console.log('HomeComponent: ngAfterViewInit — starting autoplay');
      const el = this.exploreRow?.nativeElement;
      if (!el) {
        console.warn('Explore row not found (#exploreRow). Autoplay disabled.');
        return;
      }

      // use pointerenter / pointerleave so entering children doesn't retrigger repeatedly
      this.unlistenPointerEnter = this.renderer.listen(el, 'pointerenter', () => this.onPointerEnter());
      this.unlistenPointerLeave = this.renderer.listen(el, 'pointerleave', () => this.onPointerLeave());

      // also listen for focus events (accessibility) but treat them separately
      this.unlistenFocusIn = this.renderer.listen(el, 'focusin', () => this.onFocusIn());
      this.unlistenFocusOut = this.renderer.listen(el, 'focusout', () => this.onFocusOut());

      // small delay to allow layout/images to stabilize
      setTimeout(() => this.startAutoplay(), 150);
    });
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    this.unlistenPointerEnter?.();
    this.unlistenPointerLeave?.();
    this.unlistenFocusIn?.();
    this.unlistenFocusOut?.();
  }

  // manual scroll method
  scrollExplore(direction: number, tilesToScroll = this.tilesToScroll) {
    const el = this.exploreRow?.nativeElement;
    if (!el) return;
    const firstTile = el.querySelector<HTMLElement>('.tile');
    if (!firstTile) return;

    const gap = this.getGap(el, 20);
    const tileWidth = firstTile.offsetWidth;
    const scrollAmount = (tileWidth + gap) * tilesToScroll;
    console.log('scrollExplore', direction, { tileWidth, gap, scrollAmount });
    el.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
  }

  // Autoplay control --------------------------------------------------
  private startAutoplay() {
    if (this.autoplayIntervalId) return;
    const el = this.exploreRow?.nativeElement;
    if (!el) {
      console.warn('startAutoplay: explore row missing');
      return;
    }
    const panel = el.parentElement as HTMLElement;
    if (panel) this.renderer.addClass(panel, 'autoplay-running');

    console.log('Autoplay started. Delay:', this.autoplayDelay);
    this.autoplayIntervalId = setInterval(() => {
      if (this.isPaused) return;
      this.advanceOne();
    }, this.autoplayDelay);
  }

  private stopAutoplay() {
    if (this.autoplayIntervalId) {
      clearInterval(this.autoplayIntervalId);
      this.autoplayIntervalId = null;
      const panel = this.exploreRow?.nativeElement?.parentElement as HTMLElement;
      if (panel) this.renderer.removeClass(panel, 'autoplay-running');
      console.log('Autoplay stopped.');
    }
  }

  private pauseAutoplay() {
    if (this.isPaused) return; // idempotent
    this.isPaused = true;
    console.log('Autoplay paused');
  }

  private resumeAutoplay() {
    if (!this.isPaused) return; // idempotent
    this.isPaused = false;
    console.log('Autoplay resumed');
  }

  // pointer/focus handlers with hoverCounter
  private onPointerEnter() {
    this.hoverCounter++;
    // pause when pointer is inside
    this.pauseAutoplay();
    // debug
    // console.log('pointerenter, hoverCounter=', this.hoverCounter);
  }

  private onPointerLeave() {
    // decrement safely
    this.hoverCounter = Math.max(0, this.hoverCounter - 1);
    // only resume when fully out
    if (this.hoverCounter === 0) {
      // small debounce to avoid flicker in edge cases
      setTimeout(() => {
        if (this.hoverCounter === 0) this.resumeAutoplay();
      }, 50);
    }
    // debug
    // console.log('pointerleave, hoverCounter=', this.hoverCounter);
  }

  private onFocusIn() {
    // treat focus as pause (keyboard users)
    this.pauseAutoplay();
  }

  private onFocusOut() {
    // resume when focus leaves the container
    setTimeout(() => {
      // ensure nothing else has focus inside
      const el = this.exploreRow?.nativeElement;
      if (!el) return;
      const active = document.activeElement;
      if (!el.contains(active)) this.resumeAutoplay();
    }, 30);
  }

  // Advance one step; if at end, loop back to start
  private advanceOne() {
    const el = this.exploreRow?.nativeElement;
    if (!el) return;
    const firstTile = el.querySelector<HTMLElement>('.tile');
    if (!firstTile) return;

    const gap = this.getGap(el, 20);
    const tileWidth = firstTile.offsetWidth;
    const scrollAmount = (tileWidth + gap) * this.tilesToScroll;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;

    if (el.scrollLeft + scrollAmount > maxScrollLeft - 5) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  private getGap(el: HTMLElement, fallback = 20) {
    const style = getComputedStyle(el);
    let gap = fallback;
    try {
      const g = style.gap || (style.columnGap || '');
      gap = parseInt(g as string, 10) || fallback;
    } catch {
      gap = fallback;
    }
    return gap;
  }

  // Toggle called by (click) on menu button
  toggleSidebar() {
    this.isSidebarOpen ? this.closeSidebar() : this.openSidebar();
  }

  openSidebar() {
    this.isSidebarOpen = true;
    // small timeout to allow class to apply before focusing first link
    setTimeout(() => {
      const el = this.sidebarEl?.nativeElement;
      if (el) {
        const firstLink = el.querySelector<HTMLElement>('a');
        firstLink?.focus();
      }
    }, 100);
    // pause autoplay when sidebar open
    this.pauseAutoplay();
  }

  closeSidebar() {
    this.isSidebarOpen = false;
    // return focus to menu button
    setTimeout(() => {
      this.menuBtn?.nativeElement?.focus();
    }, 0);
    // resume autoplay
    this.resumeAutoplay();
  }

  // Modal controls
  openNewsModal(news: any) {
    if (!news) return;
    this.lastFocusedBeforeModal = document.activeElement as HTMLElement;
    this.selectedNews = news;
    this.isNewsModalOpen = true;
    // pause autoplay while modal open
    this.pauseAutoplay();
    // focus modal container after view updated
    setTimeout(() => {
      try {
        this.newsModalEl?.nativeElement?.focus();
      } catch {}
    }, 0);
  }

  closeNewsModal() {
    this.isNewsModalOpen = false;
    this.selectedNews = null;
    // resume autoplay
    this.resumeAutoplay();
    // restore focus
    setTimeout(() => {
      if (this.lastFocusedBeforeModal) this.lastFocusedBeforeModal.focus();
    }, 0);
  }

  // Close on ESC (also closes modal)
  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(event: KeyboardEvent) {
    if (this.isNewsModalOpen) {
      event.preventDefault();
      this.closeNewsModal();
      return;
    }
    if (this.isSidebarOpen) {
      event.preventDefault();
      this.closeSidebar();
    }
  }


}
