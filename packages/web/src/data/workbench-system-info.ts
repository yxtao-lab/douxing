export type SystemInfoDynamicField = 'version' | 'serverTime';

export interface WorkbenchSystemInfoRow {
  labelKey: string;
  valueKey: string;
  dynamic?: SystemInfoDynamicField;
}

export interface WorkbenchSystemInfoGroup {
  titleKey: string;
  rows: WorkbenchSystemInfoRow[];
}

export const WORKBENCH_SYSTEM_INFO_GROUPS: WorkbenchSystemInfoGroup[] = [
  {
    titleKey: 'home.systemInfoGroups.foundation',
    rows: [
      { labelKey: 'home.systemInfoLabels.version', valueKey: 'home.systemInfoValues.version', dynamic: 'version' },
      { labelKey: 'home.systemInfoLabels.packageManager', valueKey: 'home.systemInfoValues.packageManager' },
      { labelKey: 'home.systemInfoLabels.language', valueKey: 'home.systemInfoValues.language' },
      { labelKey: 'home.systemInfoLabels.runtime', valueKey: 'home.systemInfoValues.runtime' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.web',
    rows: [
      { labelKey: 'home.systemInfoLabels.webFramework', valueKey: 'home.systemInfoValues.webFramework' },
      { labelKey: 'home.systemInfoLabels.webUi', valueKey: 'home.systemInfoValues.webUi' },
      { labelKey: 'home.systemInfoLabels.webState', valueKey: 'home.systemInfoValues.webState' },
      { labelKey: 'home.systemInfoLabels.webI18n', valueKey: 'home.systemInfoValues.webI18n' },
      { labelKey: 'home.systemInfoLabels.webHttp', valueKey: 'home.systemInfoValues.webHttp' },
      { labelKey: 'home.systemInfoLabels.webMap', valueKey: 'home.systemInfoValues.webMap' },
      { labelKey: 'home.systemInfoLabels.webBuild', valueKey: 'home.systemInfoValues.webBuild' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.mobile',
    rows: [
      { labelKey: 'home.systemInfoLabels.mobileFramework', valueKey: 'home.systemInfoValues.mobileFramework' },
      { labelKey: 'home.systemInfoLabels.mobileTargets', valueKey: 'home.systemInfoValues.mobileTargets' },
      { labelKey: 'home.systemInfoLabels.mobileStyle', valueKey: 'home.systemInfoValues.mobileStyle' },
      { labelKey: 'home.systemInfoLabels.mobileI18n', valueKey: 'home.systemInfoValues.mobileI18n' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.server',
    rows: [
      { labelKey: 'home.systemInfoLabels.serverFramework', valueKey: 'home.systemInfoValues.serverFramework' },
      { labelKey: 'home.systemInfoLabels.serverOrm', valueKey: 'home.systemInfoValues.serverOrm' },
      { labelKey: 'home.systemInfoLabels.serverValidation', valueKey: 'home.systemInfoValues.serverValidation' },
      { labelKey: 'home.systemInfoLabels.serverAuth', valueKey: 'home.systemInfoValues.serverAuth' },
      { labelKey: 'home.systemInfoLabels.serverUpload', valueKey: 'home.systemInfoValues.serverUpload' },
      { labelKey: 'home.systemInfoLabels.serverRuntime', valueKey: 'home.systemInfoValues.serverRuntime' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.ai',
    rows: [
      { labelKey: 'home.systemInfoLabels.aiService', valueKey: 'home.systemInfoValues.aiService' },
      { labelKey: 'home.systemInfoLabels.aiOrchestration', valueKey: 'home.systemInfoValues.aiOrchestration' },
      { labelKey: 'home.systemInfoLabels.aiModels', valueKey: 'home.systemInfoValues.aiModels' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.data',
    rows: [
      { labelKey: 'home.systemInfoLabels.database', valueKey: 'home.systemInfoValues.database' },
      { labelKey: 'home.systemInfoLabels.cache', valueKey: 'home.systemInfoValues.cache' },
      { labelKey: 'home.systemInfoLabels.container', valueKey: 'home.systemInfoValues.container' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.integrations',
    rows: [
      { labelKey: 'home.systemInfoLabels.mapProvider', valueKey: 'home.systemInfoValues.mapProvider' },
      { labelKey: 'home.systemInfoLabels.objectStorage', valueKey: 'home.systemInfoValues.objectStorage' },
      { labelKey: 'home.systemInfoLabels.payment', valueKey: 'home.systemInfoValues.payment' },
      { labelKey: 'home.systemInfoLabels.sms', valueKey: 'home.systemInfoValues.sms' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.shared',
    rows: [
      { labelKey: 'home.systemInfoLabels.sharedPackage', valueKey: 'home.systemInfoValues.sharedPackage' },
      { labelKey: 'home.systemInfoLabels.mlPipeline', valueKey: 'home.systemInfoValues.mlPipeline' },
    ],
  },
  {
    titleKey: 'home.systemInfoGroups.ops',
    rows: [
      { labelKey: 'home.systemInfoLabels.reverseProxy', valueKey: 'home.systemInfoValues.reverseProxy' },
      { labelKey: 'home.systemInfoLabels.processManager', valueKey: 'home.systemInfoValues.processManager' },
      { labelKey: 'home.systemInfoLabels.serverTime', valueKey: 'home.systemInfoValues.serverTime', dynamic: 'serverTime' },
    ],
  },
];
