<script setup lang="ts">
import { ref } from 'vue'

const form = ref({
  theme: 'light',
  language: 'zh-CN',
  autoStart: false
})
</script>

<template>
  <div class="settings-page">
    <el-card>
      <template #header>
        <span>系统设置</span>
      </template>
      <el-form :model="form" label-width="100px">
        <el-form-item label="主题">
          <el-radio-group v-model="form.theme">
            <el-radio value="light">浅色</el-radio>
            <el-radio value="dark">深色</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 200px">
            <el-option label="简体中文" value="zh-CN" />
            <el-option label="English" value="en-US" />
          </el-select>
        </el-form-item>
        <el-form-item label="开机启动">
          <el-switch v-model="form.autoStart" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
}
</style>
