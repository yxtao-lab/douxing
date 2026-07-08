import { defineComponent, h } from 'vue';

/**
 * 渲染工具栏 SVG 图标。
 *
 * @param paths - SVG path 列表
 * @returns 图标渲染函数
 */
function renderToolbarIcon(paths: string[]) {
  return () =>
    h(
      'svg',
      {
        class: 'workflow-editor-toolbar-icon',
        viewBox: '0 0 24 24',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
      },
      paths.map((d) =>
        h('path', {
          d,
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      ),
    );
}

/** 撤销：逆时针弯箭头 */
export const WorkflowToolbarUndoIcon = defineComponent({
  name: 'WorkflowToolbarUndoIcon',
  render: renderToolbarIcon([
    'M3 7v6h6',
    'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
  ]),
});

/** 重做：顺时针弯箭头 */
export const WorkflowToolbarRedoIcon = defineComponent({
  name: 'WorkflowToolbarRedoIcon',
  render: renderToolbarIcon([
    'M21 7v6h-6',
    'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13',
  ]),
});

/** 变更历史：时钟 */
export const WorkflowToolbarHistoryIcon = defineComponent({
  name: 'WorkflowToolbarHistoryIcon',
  render: renderToolbarIcon([
    'M12 7v5l3 2',
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  ]),
});
