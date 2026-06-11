<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{
  title?: string;
}>();

const sheetRef = ref<HTMLElement | null>(null);
let _triggerElement: HTMLElement | null = null;

// --- Visual viewport tracking (keeps sheet above the keyboard on mobile) ---
const vpHeight = ref(
  typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 600
);
const vpOffsetTop = ref(0);

function syncViewport() {
  const vv = window.visualViewport;
  vpHeight.value = vv ? vv.height : window.innerHeight;
  vpOffsetTop.value = vv ? vv.offsetTop : 0;
}

const overlayStyle = computed(() => ({
  height: `${vpHeight.value}px`,
  top: `${vpOffsetTop.value}px`,
}));

// --- Keyboard: Escape + focus trap ---
function handleKeyDown(e: KeyboardEvent) {
  if (!open.value) return;
  if (e.key === 'Escape') {
    open.value = false;
    return;
  }
  if (e.key === 'Tab') {
    const focusable = Array.from(
      sheetRef.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
    );
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

onMounted(() => {
  syncViewport();
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', syncViewport);
  window.visualViewport?.removeEventListener('scroll', syncViewport);
  document.removeEventListener('keydown', handleKeyDown);
});

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Auto-focus only on pointer devices (desktop); skip on touch to avoid keyboard
// popping up before the sheet animation completes.
const isTouch =
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)')?.matches;

watch(open, async (isOpen) => {
  if (isOpen) {
    _triggerElement = document.activeElement as HTMLElement;
    if (!isTouch) {
      await nextTick();
      // Scope to .sheet-body so the close button (in .sheet-header) is not focused first
      const body = sheetRef.value?.querySelector<HTMLElement>('.sheet-body');
      const focusable = (body ?? sheetRef.value)?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.focus();
    }
  } else {
    _triggerElement?.focus();
    _triggerElement = null;
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-overlay" :style="overlayStyle" @click.self="open = false">
        <div
          ref="sheetRef"
          class="sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="props.title || 'Dialog'"
        >
          <div v-if="props.title" class="sheet-header">
            <h3 class="sheet-title">{{ props.title }}</h3>
            <button class="sheet-close" aria-label="Close" @mousedown.prevent @click="open = false">
              <i class="pi pi-times" />
            </button>
          </div>
          <div class="sheet-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Shared overlay ── */
.sheet-overlay {
  position: fixed;
  /* top and height are set dynamically via :style to track the visual viewport
     (keeps the sheet above the keyboard when it appears on mobile) */
  top: 0;
  left: 0;
  right: 0;
  height: 100%; /* JS overrides this immediately on mount */
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  /* Mobile default: sheet anchored to bottom */
  align-items: flex-end;
  justify-content: center;
}

/* ── Shared sheet panel ── */
.sheet {
  background: var(--p-surface-card);
  box-sizing: border-box;
  width: 100%;
  max-height: 90dvh;
  overflow-y: auto;
  padding: var(--space-3);
  /* Mobile: rounded top corners only, fills viewport width */
  border-radius: 16px 16px 0 0;
  /* Account for iPhone home bar */
  padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.sheet-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.sheet-close {
  min-height: 44px;
  min-width: 44px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* ── Mobile: slide-up animation ── */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 200ms ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 250ms ease;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}

/* ── Desktop (≥ 768px): centered dialog ── */
@media (min-width: 768px) {
  .sheet-overlay {
    align-items: center;
  }

  .sheet {
    width: 480px;
    max-height: 85vh;
    border-radius: 12px;
    padding-bottom: var(--space-3);
  }

  /* Override slide-up: use fade + scale instead */
  .sheet-enter-from .sheet,
  .sheet-leave-to .sheet {
    transform: scale(0.95);
  }
}
</style>
