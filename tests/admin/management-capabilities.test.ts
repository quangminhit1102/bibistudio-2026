import {it,expect} from 'vitest';
import {createAdminStore} from '../../src/features/admin/demo/store';
import {ensureDataset} from '../../src/features/admin/demo/registry';
import {createEntityService} from '../../src/features/admin/services/entity-service';
import {postConfig} from '../../src/features/admin/content/config';
import {userConfig} from '../../src/features/admin/accounts/config';
it('post duplication and user-specific detail paths are exposed',()=>{expect(postConfig.duplicate).toBe(true);expect(userConfig.detailHref?.('user-1')).toBe('/admin/accounts/users/user-1');});
it('book list filters array relations and available inventory',async()=>{const store=createAdminStore('book-filters');try{await ensureDataset(store,'books');const book=(await store.list('books'))[0];const service=createEntityService(store,'books',()=>({userId:'user-1',roleId:'super-admin'}));expect((await service.list({page:1,pageSize:100,filters:{authorIds:book.authorIds[0],genreIds:book.genreIds[0],publisherId:book.publisherId}})).items.some(b=>b.id===book.id)).toBe(true);await store.transaction(['books'],tx=>tx.put('books',{...book,stock:0,reserved:0}));const unavailable=await service.list({page:1,pageSize:100,filters:{availability:'out-of-stock'}});expect(unavailable.items.some(b=>b.id===book.id)).toBe(true);}finally{await store.destroy();}});
