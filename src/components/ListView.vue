<template>
    <div class="list-container">
        <div v-for="(item, index) in items" :key="index" class="list-item">
            <div class="text" :style="getTextStyle(item, index)">
                {{ item.text }}
            </div>
            <div class="images">
                <div v-for="(image, idx) in item.images" :key="idx" class="image-wrapper">
                    <img :src="image.url" :alt="image.caption" :title="image.caption" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "ListView",
    data() {
        return {
            items: [],
        };
    },
    mounted() {
        fetch("/table.config.json")
            .then((response) => response.json())
            .then((data) => {
                this.items = data;
            })
            .catch((error) => console.error("Error loading config.json:", error));
    },
    methods: {
        getTextStyle(item, index) {
            // 背景颜色逻辑
            let bgColor = item.bgColor === "auto" || !item.bgColor
                ? `hsl(${(index * 60) % 360}, 100%, 50%)`
                : item.bgColor;

            // 透明度逻辑
            let opacity = item.opacity === "auto" || !item.opacity
                ? 0.5
                : parseFloat(item.opacity);

            return {
                backgroundColor: bgColor,
                opacity: opacity,
            };
        },
    },
};
</script>

<style>
.list-container {
    display: flex;
    flex-direction: column;
    gap: 1em;
    /* 列表居中 */
    align-items: center;
    /* 确保在页面中居中 */
    margin: 0 auto;
    /* 列表宽度自适应内容 */
    width: fit-content;
}

.list-item {
    display: grid;
    /* 左侧固定宽度，右侧自动适应 */
    grid-template-columns: 8em auto;
    gap: 1em;
    align-items: flex-start;
    border: 1px solid #ddd;
    padding: 1em;
    border-radius: 5px;
}

.text {
    flex: 1;
    font-size: 1.2em;
    color: #333;
    /* 内边距，保持文字与背景的距离 */
    padding: 10px;
    /* 背景颜色填充整个左侧区域 */
    width: 100%;
    /* 确保高度覆盖父元素 */
    height: 100%;
    /* 包括 padding 在内计算宽高 */
    box-sizing: border-box;
    /* 启用 flex 布局 */
    display: flex;
    /* 水平居中 */
    justify-content: center;
    /* 垂直居中 */
    align-items: center;
    /* 禁止选择表格中的文字 */
    user-select: none;
}


.images {
    display: grid;
    /* 一行最多 7 张图片，每张图片 90px 宽 */
    grid-template-columns: repeat(7, 90px);
    gap: 10px;
}

.image-wrapper p {
    /* 不显示图片下的文本 */
    display: none;
}

.image-wrapper img {
    position: relative;
    /* 鼠标悬停可见提示 */
    cursor: pointer;
}
</style>