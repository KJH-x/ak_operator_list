<template>
  <div id="app">
    <header class="header">
      <h1>我的列表</h1>
    </header>
    <main>
      <ListView />
    </main>
  </div>
</template>

<script>
import ListView from './components/ListView.vue';

export default {
  name: 'App',
  components: {
    ListView,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  margin: 0;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background-color: #42b983;
  color: white;
  text-align: center;
  padding: 1em 0;
  z-index: 1000;
  user-select: none; /* 禁止选择文本 */
}

main {
  margin-top: 70px; /* 给出 header 的高度 */
  padding: 1em;
}

html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center; /* 水平居中 */
}
</style>
