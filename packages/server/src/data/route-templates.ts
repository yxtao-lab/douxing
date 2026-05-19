/** MVP：基于模板的路线生成数据（模拟 AI 规划） */

export interface RouteDayPlan {
  date: string;
  title: string;
  attractions: Array<{
    name: string;
    time: string;
    cost: number;
    description: string;
  }>;
}

export interface RouteTemplate {
  city: string;
  keywords: string[];
  name: string;
  description: string;
  budgetRange: string;
  days: number;
  interestTags: string[];
  routeDetail: { days: RouteDayPlan[] };
  unlockPrice: number;
}

export const ROUTE_TEMPLATES: RouteTemplate[] = [
  {
    city: '杭州',
    keywords: ['杭州', '西湖', '江南'],
    name: '杭州西湖文化三日游',
    description: '漫步西湖、品龙井、访灵隐，适合首次来杭的休闲之旅。',
    budgetRange: '2000-4000',
    days: 3,
    interestTags: ['文化', '自然', '美食'],
    unlockPrice: 9.9,
    routeDetail: {
      days: [
        {
          date: '第1天',
          title: '西湖经典',
          attractions: [
            { name: '断桥残雪', time: '09:00-11:00', cost: 0, description: '西湖十景之一' },
            { name: '雷峰塔', time: '14:00-16:00', cost: 40, description: '登塔俯瞰西湖' },
            { name: '河坊街', time: '18:00-20:00', cost: 80, description: '品尝杭帮小吃' },
          ],
        },
        {
          date: '第2天',
          title: '禅意人文',
          attractions: [
            { name: '灵隐寺', time: '08:30-11:30', cost: 75, description: '千年古刹' },
            { name: '龙井村', time: '14:00-17:00', cost: 50, description: '品茶赏景' },
          ],
        },
        {
          date: '第3天',
          title: '古镇风情',
          attractions: [
            { name: '西溪湿地', time: '09:00-12:00', cost: 80, description: '城市湿地氧吧' },
            { name: '南宋御街', time: '14:00-17:00', cost: 0, description: '宋韵文化街区' },
          ],
        },
      ],
    },
  },
  {
    city: '杭州',
    keywords: ['亲子', '儿童', '家庭'],
    name: '杭州亲子欢乐两日游',
    description: '动物园、科技馆与乐园组合，带娃轻松玩。',
    budgetRange: '1500-3000',
    days: 2,
    interestTags: ['亲子', '娱乐'],
    unlockPrice: 9.9,
    routeDetail: {
      days: [
        {
          date: '第1天',
          title: '动物与自然',
          attractions: [
            { name: '杭州野生动物世界', time: '09:00-15:00', cost: 220, description: '近距离看动物' },
            { name: '湘湖', time: '16:00-18:00', cost: 0, description: '湖边散步放松' },
          ],
        },
        {
          date: '第2天',
          title: '科普探索',
          attractions: [
            { name: '浙江科技馆', time: '09:30-12:00', cost: 0, description: '互动科普体验' },
            { name: '杭州乐园', time: '13:30-18:00', cost: 180, description: '游乐项目丰富' },
          ],
        },
      ],
    },
  },
  {
    city: '上海',
    keywords: ['上海', '魔都', '迪士尼'],
    name: '上海都市经典三日游',
    description: '外滩夜景、豫园老城、陆家嘴天际线一网打尽。',
    budgetRange: '3000-6000',
    days: 3,
    interestTags: ['都市', '购物', '夜景'],
    unlockPrice: 12.9,
    routeDetail: {
      days: [
        {
          date: '第1天',
          title: '浦江两岸',
          attractions: [
            { name: '外滩', time: '09:00-11:00', cost: 0, description: '万国建筑博览' },
            { name: '南京路步行街', time: '14:00-17:00', cost: 200, description: '购物美食' },
            { name: '陆家嘴观景台', time: '19:00-21:00', cost: 180, description: '俯瞰魔都夜景' },
          ],
        },
        {
          date: '第2天',
          title: '老城风情',
          attractions: [
            { name: '豫园', time: '09:00-12:00', cost: 40, description: '江南园林' },
            { name: '田子坊', time: '14:00-17:00', cost: 100, description: '石库门创意街区' },
          ],
        },
        {
          date: '第3天',
          title: '文艺之旅',
          attractions: [
            { name: '武康路', time: '10:00-12:00', cost: 0, description: '梧桐街区漫步' },
            { name: '上海博物馆', time: '14:00-17:00', cost: 0, description: '国宝级馆藏' },
          ],
        },
      ],
    },
  },
  {
    city: '北京',
    keywords: ['北京', '故宫', '长城'],
    name: '北京历史文化三日游',
    description: '故宫、长城、胡同，感受千年帝都气韵。',
    budgetRange: '2500-5000',
    days: 3,
    interestTags: ['文化', '历史'],
    unlockPrice: 12.9,
    routeDetail: {
      days: [
        {
          date: '第1天',
          title: '皇城根下',
          attractions: [
            { name: '故宫博物院', time: '08:30-12:30', cost: 60, description: '需提前预约' },
            { name: '景山公园', time: '14:00-16:00', cost: 2, description: '俯瞰紫禁城' },
          ],
        },
        {
          date: '第2天',
          title: '万里长城',
          attractions: [
            { name: '慕田峪长城', time: '07:00-15:00', cost: 180, description: '人少景美' },
          ],
        },
        {
          date: '第3天',
          title: '胡同京味',
          attractions: [
            { name: '什刹海', time: '10:00-13:00', cost: 0, description: '胡同游船' },
            { name: '南锣鼓巷', time: '14:00-17:00', cost: 80, description: '老北京小吃' },
          ],
        },
      ],
    },
  },
  {
    city: '成都',
    keywords: ['成都', '熊猫', '美食'],
    name: '成都美食休闲两日游',
    description: '看熊猫、吃火锅、逛宽窄巷子，巴适得很。',
    budgetRange: '1500-3500',
    days: 2,
    interestTags: ['美食', '休闲'],
    unlockPrice: 9.9,
    routeDetail: {
      days: [
        {
          date: '第1天',
          title: '萌宠与美食',
          attractions: [
            { name: '大熊猫繁育研究基地', time: '08:00-11:00', cost: 55, description: '早去看熊猫进食' },
            { name: '宽窄巷子', time: '14:00-18:00', cost: 120, description: '川菜与小吃' },
          ],
        },
        {
          date: '第2天',
          title: '市井生活',
          attractions: [
            { name: '人民公园', time: '09:00-11:00', cost: 30, description: '盖碗茶体验' },
            { name: '锦里古街', time: '14:00-17:00', cost: 80, description: '三国文化街区' },
          ],
        },
      ],
    },
  },
];
