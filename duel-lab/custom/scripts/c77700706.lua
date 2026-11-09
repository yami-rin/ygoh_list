--秩序騎士キャバルリー
--Order Knight Cavalry (original card)
local s,id=GetID()
local SET_ORDER_KNIGHT=0x17c6
--EDOPro takes a "must use" group before the materials; MDPro3 (YGOPro) has no such argument (compat-mdpro3.lua).
local function xyzable(sc,mg)
	if Xyz.NoMustArg then return sc:IsXyzSummonable(mg) end
	return sc:IsXyzSummonable(nil,mg)
end
local function xyzsummon(tp,sc,mg)
	if Xyz.NoMustArg then return Duel.XyzSummon(tp,sc,mg) end
	return Duel.XyzSummon(tp,sc,nil,mg)
end
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Xyz Summon: 2+ Level 9 "Order Knight" monsters
	Xyz.AddProcedure(c,aux.FilterBoolFunctionEx(Card.IsSetCard,SET_ORDER_KNIGHT),9,2,nil,nil,Xyz.InfiniteMats)
	--① Special Summoned: attach 1 monster on the field or in a GY to this card as material
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1:SetTarget(s.mattg)
	e1:SetOperation(s.matop)
	c:RegisterEffect(e1)
	--② your Main Phase: detach 2 materials on the field, Special Summon 1 Rank 9 Xyz Monster from the Extra Deck
	--(it cannot attack and its effects cannot be activated this turn)
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_IGNITION)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1,{id,0})
	e2:SetTarget(s.sptg)
	e2:SetOperation(s.spop)
	c:RegisterEffect(e2)
	--③ the turn the opponent activated a monster effect: Xyz Summon using monsters you control;
	--that Xyz Monster is unaffected by the opponent's monster effects. Quick: usable on either turn once the condition is met.
	local e3=Effect.CreateEffect(c)
	e3:SetDescription(aux.Stringid(id,2))
	e3:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e3:SetType(EFFECT_TYPE_QUICK_O)
	e3:SetCode(EVENT_FREE_CHAIN)
	e3:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E+TIMING_END_PHASE)
	e3:SetRange(LOCATION_MZONE)
	e3:SetCountLimit(1,{id,1})
	e3:SetCondition(function(e,tp) return Duel.GetFlagEffect(tp,id)>0 end)
	e3:SetTarget(s.xyztg)
	e3:SetOperation(s.xyzop)
	c:RegisterEffect(e3)
	if not s.global_check then
		s.global_check=true
		local ge=Effect.GlobalEffect()
		ge:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_CONTINUOUS)
		ge:SetCode(EVENT_CHAINING)
		ge:SetOperation(s.checkop)
		Duel.RegisterEffect(ge,0)
	end
end
s.listed_series={SET_ORDER_KNIGHT}
--flag for the player whose opponent activated a monster effect this turn
function s.checkop(e,tp,eg,ep,ev,re,r,rp)
	if re:IsActiveType(TYPE_MONSTER) then Duel.RegisterFlagEffect(1-rp,id,RESET_PHASE+PHASE_END,0,1) end
end
function s.matfilter(c)
	if c:IsLocation(LOCATION_GRAVE) then return c:IsMonster() end
	return not c:IsType(TYPE_TOKEN)
end
function s.mattg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsType(TYPE_XYZ)
		and Duel.IsExistingMatchingCard(s.matfilter,tp,LOCATION_MZONE+LOCATION_GRAVE,LOCATION_MZONE+LOCATION_GRAVE,1,c) end
end
function s.matop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if not (c:IsRelateToEffect(e) and c:IsFaceup()) then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_XMATERIAL)
	local g=Duel.SelectMatchingCard(tp,aux.NecroValleyFilter(s.matfilter),tp,LOCATION_MZONE+LOCATION_GRAVE,LOCATION_MZONE+LOCATION_GRAVE,1,1,c)
	local tc=g:GetFirst()
	if not tc then return end
	Duel.HintSelection(g)
	local og=tc:GetOverlayGroup()
	if #og>0 then Duel.SendtoGrave(og,REASON_RULE) end
	Duel.Overlay(c,g)
end
function s.spfilter(c,e,tp)
	return c:IsType(TYPE_XYZ) and c:IsRank(9) and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
		and Duel.GetLocationCountFromEx(tp,tp,nil,c)>0
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.CheckRemoveOverlayCard(tp,1,1,2,REASON_EFFECT)
		and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_EXTRA,0,1,nil,e,tp) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.RemoveOverlayCard(tp,1,1,2,2,REASON_EFFECT)~=2 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local tc=Duel.SelectMatchingCard(tp,s.spfilter,tp,LOCATION_EXTRA,0,1,1,nil,e,tp):GetFirst()
	if tc and Duel.SpecialSummonStep(tc,0,tp,tp,false,false,POS_FACEUP) then
		local e1=Effect.CreateEffect(e:GetHandler())
		e1:SetType(EFFECT_TYPE_SINGLE)
		e1:SetCode(EFFECT_CANNOT_ATTACK)
		e1:SetReset(RESET_EVENT+RESETS_STANDARD+RESET_PHASE+PHASE_END)
		tc:RegisterEffect(e1,true)
		local e2=e1:Clone()
		e2:SetCode(EFFECT_CANNOT_TRIGGER)
		tc:RegisterEffect(e2,true)
	end
	Duel.SpecialSummonComplete()
end
function s.xyzfilter(c,mg)
	return xyzable(c,mg)
end
function s.xyztg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then
		local mg=Duel.GetMatchingGroup(Card.IsFaceup,tp,LOCATION_MZONE,0,nil)
		return Duel.IsExistingMatchingCard(s.xyzfilter,tp,LOCATION_EXTRA,0,1,nil,mg)
	end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
function s.xyzop(e,tp,eg,ep,ev,re,r,rp)
	local mg=Duel.GetMatchingGroup(Card.IsFaceup,tp,LOCATION_MZONE,0,nil)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local sc=Duel.SelectMatchingCard(tp,s.xyzfilter,tp,LOCATION_EXTRA,0,1,1,nil,mg):GetFirst()
	if not sc then return end
	xyzsummon(tp,sc,mg)
	--the Summon is performed after this operation: the effect is kept when the card moves to the field
	local e1=Effect.CreateEffect(e:GetHandler())
	e1:SetDescription(aux.Stringid(id,3))
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetProperty(EFFECT_FLAG_CLIENT_HINT)
	e1:SetCode(EFFECT_IMMUNE_EFFECT)
	e1:SetValue(s.immval)
	e1:SetReset(RESET_EVENT+RESETS_STANDARD-RESET_TOFIELD)
	sc:RegisterEffect(e1,true)
end
function s.immval(e,te)
	return te:GetOwnerPlayer()~=e:GetHandlerPlayer() and te:IsActiveType(TYPE_MONSTER)
end
