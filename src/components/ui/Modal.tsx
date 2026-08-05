import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconText } from './icons';

/**
 * Стек открытых модальных окон в порядке открытия.
 *
 * `.modal-backdrop` = z-40, `.modal-shell` = z-50 — одни и те же классы у КАЖДОГО окна.
 * Порядок отрисовки внутри одного stacking-контекста сначала сравнивает z-index и только
 * потом порядок в DOM, поэтому у вложенного окна (подтверждение поверх менеджера
 * сохранений) затемнение с z-40 оказывалось ПОД панелью родителя с z-50: панель не
 * затемнялась и оставалась кликабельной. Каждому окну нужен собственный слой: индекс в
 * этом стеке даёт смещение z-index, так что затемнение вложенного окна гарантированно
 * выше панели того, что под ним.
 */
const modalStack: symbol[] = [];

/** Шаг слоя. Должен быть больше разницы shell(50) − backdrop(40). */
const LAYER_STEP = 20;

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[min(96vw,1400px)]',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Rendered in the title bar, left of the close button. */
  actions?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof WIDTHS;
  /** Set false for destructive flows that must be dismissed explicitly. */
  dismissOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * One modal shell for the whole app.
 *
 * Every modal here was hand-rolled: its own backdrop div, its own centring transform, its
 * own close button, and none of them trapped focus, closed on Escape, restored focus on
 * exit, or locked body scroll. This does all of that in one place.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  actions,
  footer,
  size = 'md',
  dismissOnBackdrop = true,
  children,
}: ModalProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  /*
   * onClose приходит из вызывающего кода почти всегда как новая стрелка на каждый рендер
   * (`onClose={() => setShowX(false)}`). Если положить его в зависимости эффекта, то у
   * родителя, который перерисовывается на каждом тике игры (App, PrestigePanel), эффект
   * пересоздавался бы 20 раз в секунду: cleanup каждый раз возвращает фокус на кнопку,
   * открывшую окно, rAF-автофокус отменяется и ставится заново, body.overflow дёргается.
   * Печатать в поле внутри такого окна было невозможно. Держим колбэк в ref — эффект
   * зависит только от `open` и отрабатывает ровно один раз за открытие.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Место окна в стеке открытых окон -> смещение z-index. useLayoutEffect, чтобы слой был
  // назначен до отрисовки кадра и вложенное окно не мигнуло под родителем.
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol('modal');
  const [layer, setLayer] = useState(0);

  useLayoutEffect(() => {
    if (!open) return;
    const id = idRef.current!;
    modalStack.push(id);
    setLayer(modalStack.length - 1);
    return () => {
      const index = modalStack.indexOf(id);
      if (index !== -1) modalStack.splice(index, 1);
    };
  }, [open]);

  // Escape to close + focus trap + focus restore.
  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      // Слушатель висит на document у каждого открытого окна, а stopPropagation не
      // останавливает других слушателей того же узла. Escape обрабатывает только верхнее
      // окно, иначе одно нажатие закрыло бы всю стопку разом.
      if (modalStack[modalStack.length - 1] !== idRef.current) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !shellRef.current) return;

      const focusable = shellRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    // Lock background scroll without a layout jump.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus in on the next frame, once the shell exists.
    const raf = requestAnimationFrame(() => {
      const shell = shellRef.current;
      if (!shell) return;
      // Селектор-список в одном querySelector вернул бы ПЕРВОЕ совпадение в порядке DOM,
      // а шапка окна идёт раньше тела: кнопку «Закрыть» всегда выбирало вперёд явного
      // [data-autofocus] в футере. Приоритет должен задавать автор окна, а не вёрстка.
      const target =
        shell.querySelector<HTMLElement>('[data-autofocus]') ??
        shell.querySelector<HTMLElement>('input:not([disabled])') ??
        shell.querySelector<HTMLElement>('button:not([disabled])');
      target?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="modal-backdrop"
        style={{ zIndex: 40 + layer * LAYER_STEP }}
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`modal-shell ${WIDTHS[size]}`}
        style={{ zIndex: 50 + layer * LAYER_STEP }}
      >
        {(title || actions) && (
          <div className="modal-title-bar">
            <div className="flex min-w-0 items-center gap-2.5">
              {icon && <span className="shrink-0 text-accent">{icon}</span>}
              <div className="min-w-0">
                {title && (
                  <h2 className="truncate text-sm font-semibold text-content-primary">
                    {typeof title === 'string' ? <IconText>{title}</IconText> : title}
                  </h2>
                )}
                {subtitle && (
                  <p className="truncate text-2xs text-content-faint">
                    {typeof subtitle === 'string' ? <IconText>{subtitle}</IconText> : subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {actions}
              <button type="button" onClick={onClose} className="icon-btn" aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-edge bg-surface-2 px-4 py-3">{footer}</div>
        )}
      </div>
    </>,
    document.body,
  );
}
