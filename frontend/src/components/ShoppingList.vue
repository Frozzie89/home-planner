<script setup lang="ts">
import { ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

interface Product {
    name: string;
    quantity?: number;
}

const products = ref<Product[]>([
    { name: 'Pâtes', quantity: 2 },
    { name: 'Frites', quantity: 1 },
    { name: 'Riz', quantity: 3 },
]);
</script>

<template>
    <h1>ShoppingList </h1>
    <DataTable :value="products">
        <Column field="quantity" header="#"></Column>
        <Column field="name" header="Name"></Column>
    </DataTable>

</template>

<style scoped>
</style>