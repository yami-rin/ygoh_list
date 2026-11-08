--Compatibility block for MDPro3 (YGOPro/mycard script API).
--scripts/install-custom.py prepends this to every original card script copied into MDPro3.
--The custom scripts are written for EDOPro (Duel Lab); on EDOPro every guard below is a no-op.
if not Card.IsSpellTrap then
	SUMMON_TYPE_TRIBUTE=SUMMON_TYPE_TRIBUTE or SUMMON_TYPE_ADVANCE
	HINTMSG_NEGATE=HINTMSG_NEGATE or HINTMSG_DISABLE
	TIMINGS_CHECK_MONSTER_E=TIMINGS_CHECK_MONSTER_E or TIMINGS_CHECK_MONSTER
	function Card.IsSpellTrap(c) return c:IsType(TYPE_SPELL+TYPE_TRAP) end
	Card.IsTrap=Card.IsTrap or function(c) return c:IsType(TYPE_TRAP) end
	Effect.IsMonsterEffect=Effect.IsMonsterEffect or function(e) return e:IsActiveType(TYPE_MONSTER) end
	Duel.GetTargetCards=Duel.GetTargetCards or function(e)
		return Duel.GetChainInfo(0,CHAININFO_TARGET_CARDS):Filter(Card.IsRelateToEffect,nil,e)
	end
	function Card.IsMonster(c) return c:IsType(TYPE_MONSTER) end
	function Card.IsLinkMonster(c) return c:IsType(TYPE_LINK) end
	function Card.IsLinkSummoned(c) return c:IsSummonType(SUMMON_TYPE_LINK) end
	function Card.IsNegatable(c) return aux.NegateAnyFilter(c) end
	function Card.IsNegatableMonster(c) return aux.NegateMonsterFilter(c) end
	function Group.Iter(g)
		local list,tc={},g:GetFirst()
		while tc do list[#list+1]=tc tc=g:GetNext() end
		local i=0
		return function() i=i+1 return list[i] end
	end
	aux.FilterBoolFunctionEx=aux.FilterBoolFunctionEx or aux.FilterBoolFunction
	aux.FaceupFilter=aux.FaceupFilter or function(f,...)
		local args={...}
		return function(c) return c:IsFaceup() and f(c,table.unpack(args)) end
	end
	Link=Link or {}
	Link.AddProcedure=Link.AddProcedure or function(c,f,min,max) return aux.AddLinkProcedure(c,f,min,max or 99) end
	--Synchro.AddProcedure(c,tuner_f,1,1,nontuner_f,min,max) / Xyz.AddProcedure(c,f,lv,ct,...) (EDOPro proc_synchro/proc_xyz)
	Synchro=Synchro or {}
	Synchro.NonTuner=Synchro.NonTuner or function(f,...) return aux.NonTuner(f,...) end
	Synchro.AddProcedure=Synchro.AddProcedure or function(c,f1,min1,max1,f2,min2,max2) return aux.AddSynchroProcedure(c,f1,f2,min2 or 1,max2 or 99) end
	Xyz=Xyz or {}
	Xyz.AddProcedure=Xyz.AddProcedure or function(c,f,lv,ct,alterf,desc,maxct,op) return aux.AddXyzProcedure(c,f,lv,ct,alterf,desc,maxct,op) end
	Duel.CheckReleaseGroupCost=Duel.CheckReleaseGroupCost or function(tp,f,ct,use_hand,check,ex,...)
		return Duel.CheckReleaseGroup(tp,f,ct,ex,...)
	end
	Duel.SelectReleaseGroupCost=Duel.SelectReleaseGroupCost or function(tp,f,min,max,use_hand,check,ex,...)
		return Duel.SelectReleaseGroup(tp,f,min,max,ex,...)
	end
	--YGOPro requires the "must use" material argument explicitly (nil is fine), EDOPro allows omitting it
	local is_link_summonable,link_summon=Card.IsLinkSummonable,Duel.LinkSummon
	Card.IsLinkSummonable=function(c,mustmat,...) return is_link_summonable(c,mustmat,...) end
	Duel.LinkSummon=function(tp,c,mustmat,...) return link_summon(tp,c,mustmat,...) end
	--HintSelection takes a Group on YGOPro
	local hint_selection=Duel.HintSelection
	Duel.HintSelection=function(g,...)
		if aux.GetValueType(g)=="Card" then g=Group.FromCards(g) end
		return hint_selection(g,...)
	end
	--EDOPro count codes: SetCountLimit(n,{id,k}) and SetCountLimit(n,id,flag). YGOPro takes one number (flags OR-ed in).
	local set_count_limit=Effect.SetCountLimit
	Effect.SetCountLimit=function(e,count,code,flag)
		if type(code)=="table" then code=(code[1]%10000000)*16+(code[2] or 0) end
		if flag then code=(code or 0)|flag end
		if code then return set_count_limit(e,count,code) end
		return set_count_limit(e,count)
	end
	--Tribute Summon with a custom Tribute filter (EDOPro proc_normal.lua helpers)
	local function tribute_proc(code,c,min,max,val,desc,f)
		local e1=Effect.CreateEffect(c)
		if desc then e1:SetDescription(desc) end
		e1:SetProperty(EFFECT_FLAG_CANNOT_DISABLE+EFFECT_FLAG_UNCOPYABLE)
		e1:SetType(EFFECT_TYPE_SINGLE)
		e1:SetCode(code)
		e1:SetCondition(function(e,c,minc)
			if c==nil then return true end
			local tp=c:GetControler()
			local mg=Duel.GetMatchingGroup(function(tc) return not f or f(tc,tp) end,tp,LOCATION_MZONE,LOCATION_MZONE,nil)
			return minc<=min and Duel.CheckTribute(c,min,max,mg)
		end)
		e1:SetOperation(function(e,tp,eg,ep,ev,re,r,rp,c)
			local mg=Duel.GetMatchingGroup(function(tc) return not f or f(tc,tp) end,tp,LOCATION_MZONE,LOCATION_MZONE,nil)
			local sg=Duel.SelectTribute(tp,c,min,max,mg)
			c:SetMaterial(sg)
			Duel.Release(sg,REASON_SUMMON+REASON_MATERIAL)
		end)
		e1:SetValue(val or SUMMON_TYPE_ADVANCE)
		c:RegisterEffect(e1)
		return e1
	end
	aux.AddNormalSummonProcedure=aux.AddNormalSummonProcedure or function(c,ns,opt,min,max,val,desc,f)
		return tribute_proc(EFFECT_SUMMON_PROC,c,min,max,val,desc,f)
	end
	aux.AddNormalSetProcedure=aux.AddNormalSetProcedure or function(c,ns,opt,min,max,val,desc,f)
		return tribute_proc(EFFECT_SET_PROC,c,min,max,val,desc,f)
	end
end
