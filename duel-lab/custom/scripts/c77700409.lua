--宵刻刃－夜宵
--Dusk Hour Blade - Yayoi (original card)
local s,id=GetID()
local SET_YOIKOKU_BLADE=0x17c3
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Link Summon: 2+ "Dusk Hour Blade" monsters
	Link.AddProcedure(c,aux.FilterBoolFunctionEx(Card.IsSetCard,SET_YOIKOKU_BLADE),2)
	--"Dusk Hour Blade" monsters in your hand can also be used as material to Link Summon this card
	local e0=Effect.CreateEffect(c)
	e0:SetType(EFFECT_TYPE_FIELD)
	e0:SetRange(LOCATION_EXTRA)
	if EFFECT_EXTRA_LINK_MATERIAL then
		--YGOPro/MDPro3 (procedure.lua Auxiliary.LExtraFilter)
		e0:SetProperty(EFFECT_FLAG_UNCOPYABLE+EFFECT_FLAG_IGNORE_IMMUNE)
		e0:SetCode(EFFECT_EXTRA_LINK_MATERIAL)
		e0:SetTargetRange(LOCATION_HAND,0)
		e0:SetValue(s.ygomatval)
	else
		--EDOPro (proc_link.lua EFFECT_EXTRA_MATERIAL)
		e0:SetProperty(EFFECT_FLAG_PLAYER_TARGET+EFFECT_FLAG_CANNOT_DISABLE)
		e0:SetCode(EFFECT_EXTRA_MATERIAL)
		e0:SetTargetRange(1,0)
		e0:SetOperation(aux.TRUE)
		e0:SetValue(s.extraval)
	end
	c:RegisterEffect(e0)
	--① cannot be destroyed by battle, unaffected by other cards' effects
	local e1=Effect.CreateEffect(c)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetProperty(EFFECT_FLAG_SINGLE_RANGE)
	e1:SetCode(EFFECT_INDESTRUCTABLE_BATTLE)
	e1:SetRange(LOCATION_MZONE)
	e1:SetValue(1)
	c:RegisterEffect(e1)
	local e1b=e1:Clone()
	e1b:SetCode(EFFECT_IMMUNE_EFFECT)
	e1b:SetValue(function(e,te) return te:GetOwner()~=e:GetOwner() end)
	c:RegisterEffect(e1b)
	--② your Main Phase: draw 3, then return up to 5 cards from your GY to Deck/Extra Deck and destroy up to that many cards on the field
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_DRAW+CATEGORY_TODECK+CATEGORY_DESTROY)
	e2:SetType(EFFECT_TYPE_IGNITION)
	e2:SetProperty(EFFECT_FLAG_PLAYER_TARGET)
	e2:SetRange(LOCATION_MZONE)
	e2:SetTarget(s.drtg)
	e2:SetOperation(s.drop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_YOIKOKU_BLADE}
function s.handmat(c)
	return c:IsSetCard(SET_YOIKOKU_BLADE) and c:IsMonster()
end
function s.extraval(chk,summon_type,e,...)
	if chk==0 then
		local tp,sc=...
		if summon_type~=SUMMON_TYPE_LINK or sc~=e:GetHandler() then return Group.CreateGroup() end
		return Duel.GetMatchingGroup(s.handmat,tp,LOCATION_HAND,0,nil)
	end
end
function s.ygomatval(e,lc,mg,c,tp)
	if e:GetHandler()~=lc or not c:IsLocation(LOCATION_HAND) or not s.handmat(c) then return false,nil end
	return true,true
end
function s.drtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsPlayerCanDraw(tp,3) end
	Duel.SetTargetPlayer(tp)
	Duel.SetTargetParam(3)
	Duel.SetOperationInfo(0,CATEGORY_DRAW,nil,0,tp,3)
end
function s.drop(e,tp,eg,ep,ev,re,r,rp)
	local p,d=Duel.GetChainInfo(0,CHAININFO_TARGET_PLAYER,CHAININFO_TARGET_PARAM)
	if Duel.Draw(p,d,REASON_EFFECT)==0 then return end
	local g=Duel.GetMatchingGroup(Card.IsAbleToDeck,tp,LOCATION_GRAVE,0,nil)
	if #g==0 or not Duel.SelectYesNo(tp,aux.Stringid(id,2)) then return end
	Duel.BreakEffect()
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TODECK)
	local sg=g:Select(tp,1,5,nil)
	Duel.HintSelection(sg)
	if Duel.SendtoDeck(sg,nil,SEQ_DECKSHUFFLE,REASON_EFFECT)==0 then return end
	local ct=Duel.GetOperatedGroup():FilterCount(Card.IsLocation,nil,LOCATION_DECK+LOCATION_EXTRA)
	local dg=Duel.GetFieldGroup(tp,LOCATION_ONFIELD,LOCATION_ONFIELD)
	if ct==0 or #dg==0 or not Duel.SelectYesNo(tp,aux.Stringid(id,3)) then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_DESTROY)
	local tg=dg:Select(tp,1,ct,nil)
	Duel.HintSelection(tg)
	Duel.Destroy(tg,REASON_EFFECT)
end
