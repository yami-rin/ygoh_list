--嵐気流－絶対零度嵐
--Storm Flow - Absolute Zero (original card)
local s,id=GetID()
local SET_STORM_FLOW=0x7c1
function s.initial_effect(c)
	--Activate
	local e0=Effect.CreateEffect(c)
	e0:SetType(EFFECT_TYPE_ACTIVATE)
	e0:SetCode(EVENT_FREE_CHAIN)
	c:RegisterEffect(e0)
	--when your opponent would Special Summon: return 1 WIND Synchro you control to the Extra Deck, negate the Summon,
	--shuffle those monsters into the Deck, then Special Summon a lower-Level "Storm Flow" Synchro (treated as a Synchro Summon)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_DISABLE_SUMMON+CATEGORY_TODECK+CATEGORY_TOEXTRA+CATEGORY_SPECIAL_SUMMON)
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetCode(EVENT_SPSUMMON)
	e1:SetRange(LOCATION_SZONE)
	e1:SetCountLimit(1,id)
	e1:SetCondition(s.condition)
	e1:SetTarget(s.target)
	e1:SetOperation(s.operation)
	c:RegisterEffect(e1)
end
s.listed_series={SET_STORM_FLOW}
function s.condition(e,tp,eg,ep,ev,re,r,rp)
	return Duel.GetCurrentChain()==0 and eg:IsExists(Card.IsSummonPlayer,1,nil,1-tp)
end
--"then Special Summon a 'Storm Flow' Synchro Monster with a lower Level": the returned monster needs one in the Extra Deck
function s.basefilter(c)
	return c:IsFaceup() and c:IsAttribute(ATTRIBUTE_WIND) and c:IsType(TYPE_SYNCHRO) and c:IsAbleToExtra()
end
function s.rtfilter(c,e,tp)
	return s.basefilter(c) and Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_EXTRA,0,1,nil,e,tp,c:GetLevel(),c)
end
function s.target(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.rtfilter,tp,LOCATION_MZONE,0,1,nil,e,tp) end
	local g=eg:Filter(Card.IsSummonPlayer,nil,1-tp)
	Duel.SetOperationInfo(0,CATEGORY_DISABLE_SUMMON,g,#g,0,0)
	Duel.SetOperationInfo(0,CATEGORY_TODECK,g,#g,0,0)
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
--mc: the monster that leaves the field first (its zone counts as free)
function s.spfilter(c,e,tp,lv,mc)
	return c:IsSetCard(SET_STORM_FLOW) and c:IsType(TYPE_SYNCHRO) and c:GetLevel()<lv
		and c:IsCanBeSpecialSummoned(e,SUMMON_TYPE_SYNCHRO,tp,false,false) and Duel.GetLocationCountFromEx(tp,tp,mc,c)>0
end
function s.operation(e,tp,eg,ep,ev,re,r,rp)
	if not e:GetHandler():IsRelateToEffect(e) then return end
	--prefer a monster that still leads to the Special Summon; the negation is done even if none is left
	local rg=Duel.GetMatchingGroup(s.rtfilter,tp,LOCATION_MZONE,0,nil,e,tp)
	if #rg==0 then rg=Duel.GetMatchingGroup(s.basefilter,tp,LOCATION_MZONE,0,nil) end
	if #rg==0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TODECK)
	local tc=rg:Select(tp,1,1,nil):GetFirst()
	Duel.HintSelection(tc)
	local lv=tc:GetLevel()
	if Duel.SendtoDeck(tc,nil,SEQ_DECKSHUFFLE,REASON_EFFECT)==0 or not tc:IsLocation(LOCATION_EXTRA) then return end
	local g=eg:Filter(Card.IsSummonPlayer,nil,1-tp)
	Duel.NegateSummon(g)
	Duel.SendtoDeck(g,nil,SEQ_DECKSHUFFLE,REASON_EFFECT)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local sc=Duel.SelectMatchingCard(tp,s.spfilter,tp,LOCATION_EXTRA,0,1,1,nil,e,tp,lv):GetFirst()
	if sc then
		Duel.BreakEffect()
		if Duel.SpecialSummon(sc,SUMMON_TYPE_SYNCHRO,tp,tp,false,false,POS_FACEUP)>0 then sc:CompleteProcedure() end
	end
end
