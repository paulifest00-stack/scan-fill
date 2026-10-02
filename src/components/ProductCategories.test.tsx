import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductCategories } from './ProductCategories';
import { emptyInput } from '@/lib/products/types';
vi.mock('@/lib/products/repository',()=>({repo:{
 stores:vi.fn(async()=>[{id:'10',name:'Paulifest',type:'Shopee'}]),
 categoryLinks:vi.fn(async()=>[{id:'20',categoryId:'1',code:'100',name:'Party › Balloons'}]),
 marketplaceCategories:vi.fn(async()=>[]),linkCategory:vi.fn(),
}}));
afterEach(cleanup);
describe('product category selection',()=>{
 it('suggests a real category without automatically replacing the current choice',async()=>{
  const onSelect=vi.fn();
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ProductCategories product={{...emptyInput(),name:'Balão azul',category:'2'}} categories={[{id:'1',name:'Balões'},{id:'2',name:'Velas'}]} onSelect={onSelect}/></QueryClientProvider>);
  await screen.findByText('Paulifest · Shopee');
  await waitFor(()=>expect(screen.getByText('Balões → Party › Balloons')).toBeTruthy());
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Balões',exact:true}));
  expect(onSelect).toHaveBeenCalledWith('1');
  expect(screen.getByText('Esta categoria interna ainda não está vinculada à loja.')).toBeTruthy();
 });
});
