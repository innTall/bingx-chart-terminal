<script setup lang="ts">
import ChartStage from './components/ChartStage.vue';
import { DEFAULT_SYMBOL, SAMPLE_CANDLES } from './mocks/sampleCandles';
</script>

<template>
  <main class="h-screen w-screen overflow-hidden bg-slate-950">
    <ChartStage :symbol="DEFAULT_SYMBOL" :candles="SAMPLE_CANDLES" />
  </main>
</template>