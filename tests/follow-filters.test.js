import {it,expect} from 'vitest';
import {createFollowState} from '../src/features/follow-teams/state.js';
import {teams,memoryStorage} from './fixtures/follow-teams.js';
it('patches independent filters, rejects invalid values, preserves follows/issues and never persists filters',()=>{
 const storage=memoryStorage();const state=createFollowState({storage});state.initialize(teams);state.setFollowed('ARG',true);const record=storage.value();
 expect(state.setScheduleFilters({followOnly:true})).toMatchObject({teamCodes:['ARG'],followOnly:true,stage:'all'});
 expect(state.setScheduleFilters({stage:'final'})).toMatchObject({followOnly:true,stage:'final'});
 expect(state.setScheduleFilters({stage:'bogus',followOnly:'yes',teamCodes:[]})).toMatchObject({teamCodes:['ARG'],followOnly:true,stage:'final'});
 expect(state.setScheduleFilters({followOnly:false})).toMatchObject({followOnly:false,stage:'final'});expect(storage.value()).toBe(record);
 const reopened=createFollowState({storage});expect(reopened.initialize(teams)).toMatchObject({teamCodes:['ARG'],followOnly:false,stage:'all'});
});
