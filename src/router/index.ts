import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

export interface MenuMeta {
  title: string
  icon: string
}

export interface MenuItem {
  path: string
  meta: MenuMeta
  children?: MenuItem[]
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '首页', icon: 'HomeFilled' }
  },
  {
    path: '/software',
    name: 'Software',
    redirect: '/software/collection',
    meta: { title: '软件管理', icon: 'Grid' },
    children: [
      {
        path: 'collection',
        name: 'SoftwareCollection',
        component: () => import('@/views/software/Collection.vue'),
        meta: { title: '软件合集', icon: 'Files' }
      }
    ]
  },
  {
    path: '/environment',
    name: 'Environment',
    redirect: '/environment/package',
    meta: { title: '环境配置', icon: 'SetUp' },
    children: [
      {
        path: 'package',
        name: 'PackageManager',
        component: () => import('@/views/environment/PackageManager.vue'),
        meta: { title: '工具管理', icon: 'Box' }
      },
      {
        path: 'deps',
        name: 'PackageDeps',
        component: () => import('@/views/environment/PackageDeps.vue'),
        meta: { title: '包管理', icon: 'Coin' }
      },
      {
        path: 'cache',
        name: 'PackageCache',
        component: () => import('@/views/environment/PackageCache.vue'),
        meta: { title: '包缓存', icon: 'FolderDelete' }
      },
      {
        path: 'variables',
        name: 'EnvVariables',
        component: () => import('@/views/environment/Variables.vue'),
        meta: { title: '环境变量', icon: 'Document' }
      },
      {
        path: 'logs',
        name: 'EnvLogs',
        component: () => import('@/views/environment/Logs.vue'),
        meta: { title: '日志', icon: 'Notebook' }
      }
    ]
  },
  {
    path: '/service',
    name: 'Service',
    redirect: '/service/process',
    meta: { title: '服务', icon: 'Monitor' },
    children: [
      {
        path: 'process',
        name: 'ProcessMonitor',
        component: () => import('@/views/service/ProcessMonitor.vue'),
        meta: { title: '监控进程', icon: 'Cpu' }
      },
      {
        path: 'port',
        name: 'PortMonitor',
        component: () => import('@/views/service/PortMonitor.vue'),
        meta: { title: '监控端口', icon: 'Connection' }
      }
    ]
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { title: '设置', icon: 'Setting' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: { title: '关于', icon: 'InfoFilled' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
export { routes }
