--業火葬－魂の炉くべ
--Gokasou - Soul Stoker (original card)
local s,id=GetID()
local SET_GOKASOU=0x7c2
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Link Summon: 2 FIRE monsters
	Link.AddProcedure(c,aux.FilterBoolFunctionEx(Card.IsAttribute,ATTRIBUTE_FIRE),2,2)
	--① either player's Main Phase: banish any number of cards in the opponent's GY,
	--   Special Summon 1 "Gokasou" Link Monster with that many Link Arrows from the Extra Deck
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_REMOVE+CATEGORY_SPECIAL_SUMMON)
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetRange(LOCATION_MZONE)
	e1:SetHintTiming(0,TIMING_MAIN_END)
	e1:SetCountLimit(1,{id,0})
	e1:SetCondition(function() return Duel.IsMainPhase() end)
	e1:SetTarget(s.sptg)
	e1:SetOperation(s.spop)
	c:RegisterEffect(e1)
	--② in the GY (either turn): banish 2 other FIRE monsters from your GY, Special Summon this card
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetRange(LOCATION_GRAVE)
	e2:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e2:SetCountLimit(1,{id,1})
	e2:SetCost(s.gspcost)
	e2:SetTarget(s.gsptg)
	e2:SetOperation(s.gspop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_GOKASOU}
function s.rmfilter(c,e)
	return c:IsAbleToRemove() and c:IsCanBeEffectTarget(e)
end
function s.exfilter(c,e,tp,ct)
	return c:IsSetCard(SET_GOKASOU) and c:IsLinkMonster() and (not ct or c:GetLink()==ct)
		and c:IsCanBeSpecialSummoned(e,0,tp,false,false) and Duel.GetLocationCountFromEx(tp,tp,nil,c)>0
end
--Link ratings that can be reached: a matching Link Monster in the Extra Deck and enough targets in the opponent's GY
function s.counts(e,tp)
	local max=Duel.GetMatchingGroupCount(s.rmfilter,tp,0,LOCATION_GRAVE,nil,e)
	local ex=Duel.GetMatchingGroup(s.exfilter,tp,LOCATION_EXTRA,0,nil,e,tp)
	local nums={}
	for i=1,max do
		if ex:IsExists(function(c) return c:GetLink()==i end,1,nil) then nums[#nums+1]=i end
	end
	return nums
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	if chkc then return false end
	local nums=s.counts(e,tp)
	if chk==0 then return #nums>0 end
	local ct=nums[1]
	if #nums>1 then
		Duel.Hint(HINT_SELECTMSG,tp,aux.Stringid(id,2))
		ct=Duel.AnnounceNumber(tp,table.unpack(nums))
	end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local g=Duel.SelectTarget(tp,Card.IsAbleToRemove,tp,0,LOCATION_GRAVE,ct,ct,nil)
	Duel.SetOperationInfo(0,CATEGORY_REMOVE,g,#g,0,0)
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	local tg=Duel.GetTargetCards(e)
	if #tg==0 or Duel.Remove(tg,POS_FACEUP,REASON_EFFECT)==0 then return end
	local ct=Duel.GetOperatedGroup():FilterCount(Card.IsLocation,nil,LOCATION_REMOVED)
	if ct==0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local g=Duel.SelectMatchingCard(tp,s.exfilter,tp,LOCATION_EXTRA,0,1,1,nil,e,tp,ct)
	if #g>0 then Duel.SpecialSummon(g,0,tp,tp,false,false,POS_FACEUP) end
end
function s.cfilter(c)
	return c:IsAttribute(ATTRIBUTE_FIRE) and c:IsMonster() and c:IsAbleToRemoveAsCost()
end
function s.gspcost(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return Duel.IsExistingMatchingCard(s.cfilter,tp,LOCATION_GRAVE,0,2,c) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_REMOVE)
	local g=Duel.SelectMatchingCard(tp,s.cfilter,tp,LOCATION_GRAVE,0,2,2,c)
	Duel.Remove(g,POS_FACEUP,REASON_COST)
end
function s.gsptg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 and c:IsCanBeSpecialSummoned(e,0,tp,false,false) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,c,1,0,0)
end
function s.gspop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if c:IsRelateToEffect(e) then Duel.SpecialSummon(c,0,tp,tp,false,false,POS_FACEUP) end
end
