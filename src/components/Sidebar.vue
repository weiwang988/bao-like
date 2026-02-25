<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { routes } from '@/router'
import { 
  HomeFilled, Setting, InfoFilled, Fold, Expand,
  Grid, Files, FolderChecked, SetUp, Box, Document, Coin, FolderDelete,
  Monitor, Cpu, Connection
} from '@element-plus/icons-vue'

const props = defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const route = useRoute()
const router = useRouter()

const iconMap: Record<string, any> = {
  HomeFilled,
  Setting,
  InfoFilled,
  Grid,
  Files,
  FolderChecked,
  SetUp,
  Box,
  Document,
  Coin,
  FolderDelete,
  Monitor,
  Cpu,
  Connection
}

const menuItems = computed(() => {
  return routes.map(r => ({
    index: r.path,
    title: r.meta?.title as string,
    icon: iconMap[r.meta?.icon as string],
    children: r.children?.map(c => ({
      index: `${r.path}/${c.path}`,
      title: c.meta?.title as string,
      icon: iconMap[c.meta?.icon as string]
    }))
  }))
})

const activeMenu = computed(() => route.path)

const handleMenuSelect = (index: string) => {
  router.push(index)
}
</script>

<template>
  <div class="sidebar" :class="{ collapsed }">
    <div class="logo-container">
      <span class="logo-icon">B</span>
      <span v-show="!collapsed" class="logo-text">BaoLike</span>
    </div>
    <el-menu
      :default-active="activeMenu"
      :collapse="collapsed"
      :collapse-transition="false"
      @select="handleMenuSelect"
      class="sidebar-menu"
    >
      <template v-for="item in menuItems" :key="item.index">
        <!-- 有子菜单 -->
        <el-sub-menu v-if="item.children" :index="item.index">
          <template #title>
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.title }}</span>
          </template>
          <el-menu-item
            v-for="child in item.children"
            :key="child.index"
            :index="child.index"
          >
            <el-icon><component :is="child.icon" /></el-icon>
            <template #title>{{ child.title }}</template>
          </el-menu-item>
        </el-sub-menu>
        <!-- 无子菜单 -->
        <el-menu-item v-else :index="item.index">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </template>
    </el-menu>
    
    <div class="collapse-btn" @click="emit('toggle')">
      <el-icon>
        <Expand v-if="collapsed" />
        <Fold v-else />
      </el-icon>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 200px;
  background-color: #fff;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  transition: width 0.3s;
}

.sidebar.collapsed {
  width: 64px;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 12px;
  gap: 10px;
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 200px;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  cursor: pointer;
  border-top: 1px solid #e4e7ed;
  transition: background-color 0.2s;
}

.collapse-btn:hover {
  background-color: #f5f7fa;
}

.collapse-btn .el-icon {
  font-size: 18px;
  color: #606266;
}
</style>
