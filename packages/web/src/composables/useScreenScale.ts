import { onMounted, onUnmounted, ref } from 'vue';

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export function useScreenScale(
  designWidth = DESIGN_WIDTH,
  designHeight = DESIGN_HEIGHT,
) {
  const scale = ref(1);
  const offsetX = ref(0);
  const offsetY = ref(0);

  function updateScale() {
    const sw = window.innerWidth / designWidth;
    const sh = window.innerHeight / designHeight;
    const next = Math.min(sw, sh);
    scale.value = next;
    offsetX.value = (window.innerWidth - designWidth * next) / 2;
    offsetY.value = (window.innerHeight - designHeight * next) / 2;
  }

  onMounted(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateScale);
  });

  return { scale, offsetX, offsetY, designWidth, designHeight };
}
