import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PreferenceForm} from '../../src/features/admin/shared/forms/preference-form';
vi.mock('../../src/features/admin/shared/forms/unsaved-guard',()=>({useUnsavedChanges:()=>({status:'idle'})}));
it('cancel asks before discarding and restores the saved values',async()=>{const user=userEvent.setup();render(<PreferenceForm initial={{name:'BiBi'}} fields={[{key:'name',label:'Tên',type:'text'}]} onSave={vi.fn()}/>);await user.clear(screen.getByRole('textbox',{name:'Tên'}));await user.type(screen.getByRole('textbox',{name:'Tên'}),'Changed');await user.click(screen.getByRole('button',{name:'Hủy',exact:true}));expect(screen.getByRole('dialog',{name:'Bỏ thay đổi chưa lưu?'})).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Xác nhận'}));expect(screen.getByRole('textbox',{name:'Tên'})).toHaveValue('BiBi');});
