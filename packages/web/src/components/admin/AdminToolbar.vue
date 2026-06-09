<template>
  <div class="admin-toolbar">
    <div v-if="$slots.left" class="admin-toolbar-left">
      <slot name="left" />
    </div>
    <div class="admin-toolbar-right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts"></script>
